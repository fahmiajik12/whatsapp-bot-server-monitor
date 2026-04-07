package monitoring

import (
	"encoding/json"
	"log"
	"math"
	"os"
	"path/filepath"
	"sync"
	"time"

	"wabot-backend/internal/model"
)

type BaselineEngine struct {
	mu          sync.RWMutex
	cpuSamples  []float64
	ramSamples  []float64
	diskSamples []float64
	windowSize  int
	dataFile    string
	ticker      *time.Ticker
	stopCh      chan struct{}
}

type baselineData struct {
	CPU  []float64 `json:"cpu"`
	RAM  []float64 `json:"ram"`
	Disk []float64 `json:"disk"`
}

var baselineInstance *BaselineEngine
var baselineOnce sync.Once

func GetBaselineEngine() *BaselineEngine {
	baselineOnce.Do(func() {
		dataDir := filepath.Join(".", "data")
		os.MkdirAll(dataDir, 0755)

		baselineInstance = &BaselineEngine{
			windowSize: 60,
			dataFile:   filepath.Join(dataDir, "baseline.json"),
			stopCh:     make(chan struct{}),
		}
		baselineInstance.load()
	})
	return baselineInstance
}

func (b *BaselineEngine) SetWindowSize(size int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if size > 0 {
		b.windowSize = size
	}
}

func (b *BaselineEngine) Start(intervalSeconds int) {
	if intervalSeconds <= 0 {
		intervalSeconds = 60
	}
	b.ticker = time.NewTicker(time.Duration(intervalSeconds) * time.Second)

	go func() {
		time.Sleep(10 * time.Second)
		b.sample()

		for {
			select {
			case <-b.ticker.C:
				b.sample()
			case <-b.stopCh:
				return
			}
		}
	}()
	log.Printf("[INFO] Baseline engine dimulai (interval: %ds, window: %d)", intervalSeconds, b.windowSize)
}

func (b *BaselineEngine) Stop() {
	if b.ticker != nil {
		b.ticker.Stop()
	}
	close(b.stopCh)
	b.save()
}

func (b *BaselineEngine) sample() {
	status, err := GetSystemStatus()
	if err != nil {
		log.Printf("[WARN] Baseline sample gagal: %v", err)
		return
	}
	b.Record(status.CPU, status.RAM.UsedPercent, status.Disk.UsedPercent)
}

func (b *BaselineEngine) Record(cpu, ram, disk float64) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.cpuSamples = appendCircular(b.cpuSamples, cpu, b.windowSize)
	b.ramSamples = appendCircular(b.ramSamples, ram, b.windowSize)
	b.diskSamples = appendCircular(b.diskSamples, disk, b.windowSize)

	if len(b.cpuSamples)%10 == 0 {
		b.saveUnlocked()
	}
}

func (b *BaselineEngine) GetBaseline() model.Baseline {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return model.Baseline{
		CPU:         calcMetric(b.cpuSamples),
		RAM:         calcMetric(b.ramSamples),
		Disk:        calcMetric(b.diskSamples),
		SampleCount: len(b.cpuSamples),
		WindowSize:  b.windowSize,
	}
}

func (b *BaselineEngine) DetectAnomalies(current *model.SystemStatus, spikeMultiplier float64) []model.Anomaly {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if len(b.cpuSamples) < 5 {
		return nil
	}

	if spikeMultiplier <= 0 {
		spikeMultiplier = 1.5
	}

	var anomalies []model.Anomaly

	cpuBaseline := calcMetric(b.cpuSamples)
	if cpuBaseline.Average > 0 {
		if current.CPU > cpuBaseline.Average*spikeMultiplier {
			severity := "warning"
			if current.CPU > cpuBaseline.Average*2 || current.CPU > 90 {
				severity = "critical"
			}
			anomalies = append(anomalies, model.Anomaly{
				Type:     "cpu_spike",
				Severity: severity,
				Value:    current.CPU,
				Baseline: cpuBaseline.Average,
				Message:  "CPU spike terdeteksi — jauh di atas rata-rata normal",
				Suggestions: []string{
					"Cek top process dengan /top",
					"Kill proses dengan CPU tinggi /kill <PID>",
					"Restart service terkait /restart <service>",
				},
			})
		}

		if cpuBaseline.StdDev > 0 && current.CPU > cpuBaseline.Average+2*cpuBaseline.StdDev {
			if current.CPU <= cpuBaseline.Average*spikeMultiplier {
				anomalies = append(anomalies, model.Anomaly{
					Type:     "cpu_abnormal",
					Severity: "warning",
					Value:    current.CPU,
					Baseline: cpuBaseline.Average,
					Message:  "CPU abnormal — melebihi 2x standar deviasi",
					Suggestions: []string{
						"Monitor selama beberapa menit",
						"Cek proses yang berjalan /top",
					},
				})
			}
		}
	}

	if current.RAM.UsedPercent > 95 {
		anomalies = append(anomalies, model.Anomaly{
			Type:     "memory_pressure",
			Severity: "critical",
			Value:    current.RAM.UsedPercent,
			Baseline: calcMetric(b.ramSamples).Average,
			Message:  "Tekanan memori kritis — RAM > 95%",
			Suggestions: []string{
				"Cek memory usage /free",
				"Cek top process /top",
				"Restart service yang bocor memori",
			},
		})
	}

	diskBaseline := calcMetric(b.diskSamples)
	if len(b.diskSamples) >= 10 && diskBaseline.Average > 0 {
		growthRate := b.calcDiskGrowthRate()
		if growthRate > 0.5 {
			daysUntilFull := 0.0
			remaining := 100.0 - current.Disk.UsedPercent
			if growthRate > 0 {
				hoursUntilFull := remaining / growthRate
				daysUntilFull = hoursUntilFull / 24
			}

			severity := "warning"
			if daysUntilFull < 7 {
				severity = "critical"
			}

			anomalies = append(anomalies, model.Anomaly{
				Type:     "disk_trend",
				Severity: severity,
				Value:    current.Disk.UsedPercent,
				Baseline: diskBaseline.Average,
				Message:  "Disk berkembang cepat — prediksi penuh dalam waktu dekat",
				Suggestions: []string{
					"Cek disk usage /df",
					"Hapus log lama",
					"Cek file besar di /var/log",
				},
			})
		}
	}

	return anomalies
}

func (b *BaselineEngine) GetTrends() model.TrendData {
	b.mu.RLock()
	defer b.mu.RUnlock()

	trends := model.TrendData{}

	if len(b.diskSamples) >= 10 {
		growthRate := b.calcDiskGrowthRate()
		lastDisk := b.diskSamples[len(b.diskSamples)-1]
		remaining := 100.0 - lastDisk

		daysUntilFull := 0
		if growthRate > 0 {
			hoursUntilFull := remaining / growthRate
			daysUntilFull = int(hoursUntilFull / 24)
		}

		trends.DiskPrediction = &model.DiskPrediction{
			DaysUntilFull: daysUntilFull,
			GrowthPerDay:  growthRate * 24,
		}
	}

	if len(b.cpuSamples) >= 10 {
		metric := calcMetric(b.cpuSamples)
		half := len(b.cpuSamples) / 2
		firstHalf := calcMetric(b.cpuSamples[:half])
		secondHalf := calcMetric(b.cpuSamples[half:])

		direction := "stabil"
		if secondHalf.Average > firstHalf.Average*1.1 {
			direction = "naik ↑"
		} else if secondHalf.Average < firstHalf.Average*0.9 {
			direction = "turun ↓"
		}

		trends.CPUTrend = &model.TrendInfo{
			Direction: direction,
			Average:   metric.Average,
		}
	}

	if len(b.ramSamples) >= 10 {
		metric := calcMetric(b.ramSamples)
		half := len(b.ramSamples) / 2
		firstHalf := calcMetric(b.ramSamples[:half])
		secondHalf := calcMetric(b.ramSamples[half:])

		direction := "stabil"
		if secondHalf.Average > firstHalf.Average*1.1 {
			direction = "naik ↑"
		} else if secondHalf.Average < firstHalf.Average*0.9 {
			direction = "turun ↓"
		}

		trends.RAMTrend = &model.TrendInfo{
			Direction: direction,
			Average:   metric.Average,
		}
	}

	return trends
}

func (b *BaselineEngine) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.cpuSamples = nil
	b.ramSamples = nil
	b.diskSamples = nil
	b.saveUnlocked()
}

func (b *BaselineEngine) calcDiskGrowthRate() float64 {
	if len(b.diskSamples) < 2 {
		return 0
	}

	first := b.diskSamples[0]
	last := b.diskSamples[len(b.diskSamples)-1]
	growth := last - first

	if growth <= 0 {
		return 0
	}

	hours := float64(len(b.diskSamples)) / 60.0
	if hours <= 0 {
		hours = 1
	}

	return growth / hours
}

func (b *BaselineEngine) load() {
	data, err := os.ReadFile(b.dataFile)
	if err != nil {
		return
	}

	var bd baselineData
	if err := json.Unmarshal(data, &bd); err != nil {
		log.Printf("[WARN] Gagal load baseline data: %v", err)
		return
	}

	b.cpuSamples = bd.CPU
	b.ramSamples = bd.RAM
	b.diskSamples = bd.Disk
	log.Printf("[INFO] Baseline data dimuat: %d sampel", len(b.cpuSamples))
}

func (b *BaselineEngine) save() {
	b.mu.RLock()
	defer b.mu.RUnlock()
	b.saveUnlocked()
}

func (b *BaselineEngine) saveUnlocked() {
	bd := baselineData{
		CPU:  b.cpuSamples,
		RAM:  b.ramSamples,
		Disk: b.diskSamples,
	}

	data, err := json.Marshal(bd)
	if err != nil {
		log.Printf("[WARN] Gagal marshal baseline: %v", err)
		return
	}

	if err := os.WriteFile(b.dataFile, data, 0644); err != nil {
		log.Printf("[WARN] Gagal simpan baseline: %v", err)
	}
}

func appendCircular(slice []float64, val float64, maxSize int) []float64 {
	slice = append(slice, val)
	if len(slice) > maxSize {
		slice = slice[len(slice)-maxSize:]
	}
	return slice
}

func calcMetric(samples []float64) model.BaselineMetric {
	if len(samples) == 0 {
		return model.BaselineMetric{}
	}

	var sum, min, max float64
	min = samples[0]
	max = samples[0]

	for _, v := range samples {
		sum += v
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}

	avg := sum / float64(len(samples))

	var variance float64
	for _, v := range samples {
		diff := v - avg
		variance += diff * diff
	}
	variance /= float64(len(samples))
	stddev := math.Sqrt(variance)

	return model.BaselineMetric{
		Average: avg,
		StdDev:  stddev,
		Min:     min,
		Max:     max,
	}
}
