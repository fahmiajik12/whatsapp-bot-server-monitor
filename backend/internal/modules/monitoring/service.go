package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"

	"wabot-backend/config"
	"wabot-backend/internal/executor"
	"wabot-backend/internal/model"
)

var (
	cachedGPUName string
	cacheMutex    sync.RWMutex

	tempCacheVal  model.TemperatureInfo
	tempCacheTime time.Time

	serviceCacheVal  = make(map[string]serviceCacheEntry)
	cacheTTL         = 5 * time.Minute
)

type serviceCacheEntry struct {
	status    *model.ServiceStatus
	timestamp time.Time
}

func GetSystemStatus() (*model.SystemStatus, error) {
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca CPU: %v", err)
	}

	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("gagal membaca RAM: %v", err)
	}

	swapStat, err := mem.SwapMemory()
	if err != nil {
		return nil, fmt.Errorf("gagal membaca Swap: %v", err)
	}

	diskStat, err := disk.Usage("/")
	if err != nil {
		return nil, fmt.Errorf("gagal membaca Disk: %v", err)
	}

	uptime, err := host.Uptime()
	if err != nil {
		return nil, fmt.Errorf("gagal membaca Uptime: %v", err)
	}

	days := uptime / 86400
	hours := (uptime % 86400) / 3600
	minutes := (uptime % 3600) / 60
	uptimeStr := fmt.Sprintf("%d hari, %d jam, %d menit", days, hours, minutes)

	var cpuUsage float64
	if len(cpuPercent) > 0 {
		cpuUsage = cpuPercent[0]
	}

	gpuInfo := detectGPU()
	temps := getTemperatures()
	dbStatus := GetDBStatus()

	return &model.SystemStatus{
		CPU: cpuUsage,
		RAM: model.RAMInfo{
			Total:       vmStat.Total,
			Used:        vmStat.Used,
			Free:        vmStat.Free,
			UsedPercent: vmStat.UsedPercent,
		},
		Swap: model.SwapInfo{
			Total:       swapStat.Total,
			Used:        swapStat.Used,
			Free:        swapStat.Free,
			UsedPercent: swapStat.UsedPercent,
		},
		Disk: model.DiskInfo{
			Total:       diskStat.Total,
			Used:        diskStat.Used,
			Free:        diskStat.Free,
			UsedPercent: diskStat.UsedPercent,
		},
		GPU:          gpuInfo,
		Temperatures: temps,
		Uptime:       uptimeStr,
		Database:     dbStatus,
		Network:      GetNetworkStats(),
	}, nil
}

func getTemperatures() model.TemperatureInfo {
	cacheMutex.RLock()
	if time.Since(tempCacheTime) < cacheTTL {
		val := tempCacheVal
		cacheMutex.RUnlock()
		return val
	}
	cacheMutex.RUnlock()

	info := model.TemperatureInfo{}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sensors", "-j")
	output, err := cmd.Output()
	if err == nil {
		var data map[string]interface{}
		if err := json.Unmarshal(output, &data); err == nil {
			for key, val := range data {
				device := val.(map[string]interface{})
				
				if strings.Contains(key, "k10temp") || strings.Contains(key, "coretemp") {
					if tctl, ok := device["Tctl"].(map[string]interface{}); ok {
						info.CPU = tctl["temp1_input"].(float64)
					} else if package_id, ok := device["Package id 0"].(map[string]interface{}); ok {
						info.CPU = package_id["temp1_input"].(float64)
					}
				}

				if strings.Contains(key, "amdgpu") || strings.Contains(key, "nvidia") || strings.Contains(key, "nouveau") {
					if edge, ok := device["edge"].(map[string]interface{}); ok {
						info.GPU = edge["temp1_input"].(float64)
					} else if junction, ok := device["junction"].(map[string]interface{}); ok {
						if info.GPU == 0 {
							info.GPU = junction["temp2_input"].(float64)
						}
					}
				}

				if strings.Contains(key, "nvme") {
					if composite, ok := device["Composite"].(map[string]interface{}); ok {
						info.Disk = composite["temp1_input"].(float64)
					}
				}
			}
		}
	}

	cacheMutex.Lock()
	tempCacheVal = info
	tempCacheTime = time.Now()
	cacheMutex.Unlock()

	return info
}

func detectGPU() model.GPUInfo {
	info := model.GPUInfo{
		Name: detectGPUName(),
	}

	cardPaths := findGPUCards()
	if len(cardPaths) == 0 {
		return info
	}

	cardPath := cardPaths[0]

	info.VRAMTotal = readSysfsUint64(cardPath + "/device/mem_info_vram_total")
	info.VRAMUsed = readSysfsUint64(cardPath + "/device/mem_info_vram_used")
	info.BusyPercent = float64(readSysfsUint64(cardPath + "/device/gpu_busy_percent"))

	if info.VRAMTotal > info.VRAMUsed {
		info.VRAMFree = info.VRAMTotal - info.VRAMUsed
	}

	if info.VRAMTotal > 0 {
		info.VRAMPercent = float64(info.VRAMUsed) / float64(info.VRAMTotal) * 100
	}

	if info.VRAMTotal == 0 {
		info.VRAMTotal = readSysfsUint64(cardPath + "/device/mem_info_vis_vram_total")
		info.VRAMUsed = readSysfsUint64(cardPath + "/device/mem_info_vis_vram_used")
		if info.VRAMTotal > info.VRAMUsed {
			info.VRAMFree = info.VRAMTotal - info.VRAMUsed
		}
		if info.VRAMTotal > 0 {
			info.VRAMPercent = float64(info.VRAMUsed) / float64(info.VRAMTotal) * 100
		}
	}

	return info
}

func detectGPUName() string {
	if cachedGPUName != "" {
		return cachedGPUName
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "lspci")
	output, err := cmd.Output()
	if err == nil {
		for _, line := range strings.Split(string(output), "\n") {
			if strings.Contains(line, "VGA") || strings.Contains(line, "3D") || strings.Contains(line, "Display") {
				parts := strings.SplitN(line, ": ", 2)
				if len(parts) > 1 {
					cachedGPUName = strings.TrimSpace(parts[1])
					return cachedGPUName
				}
			}
		}
	}

	cards := findGPUCards()
	if len(cards) > 0 {
		cachedGPUName = "GPU Detected (card0)"
		return cachedGPUName
	}

	cachedGPUName = "No GPU Detected"
	return cachedGPUName
}

func findGPUCards() []string {
	var cards []string
	entries, err := os.ReadDir("/sys/class/drm")
	if err != nil {
		return cards
	}
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "card") && !strings.Contains(name, "-") {
			cardPath := "/sys/class/drm/" + name
			devicePath := cardPath + "/device"
			if _, err := os.Stat(devicePath); err == nil {
				cards = append(cards, cardPath)
			}
		}
	}
	return cards
}

func readSysfsUint64(path string) uint64 {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	val, err := strconv.ParseUint(strings.TrimSpace(string(data)), 10, 64)
	if err != nil {
		return 0
	}
	return val
}

func GetServicesStatus() ([]model.ServiceStatus, error) {
	var services []model.ServiceStatus

	for _, svc := range config.AppConfig.AllowedServices {
		status, err := GetServiceStatus(svc)
		if err != nil {
			services = append(services, model.ServiceStatus{
				Name:   svc,
				Active: "unknown",
			})
			continue
		}
		services = append(services, *status)
	}

	return services, nil
}

func GetServiceStatus(name string) (*model.ServiceStatus, error) {
	cacheMutex.RLock()
	if entry, ok := serviceCacheVal[name]; ok {
		if time.Since(entry.timestamp) < cacheTTL {
			val := entry.status
			cacheMutex.RUnlock()
			return val, nil
		}
	}
	cacheMutex.RUnlock()

	output, _ := executor.RunSystemctl("status", name)

	status := &model.ServiceStatus{
		Name: name,
	}

	lines := splitLines(output)
	for _, line := range lines {
		trimmed := trimSpace(line)
		if containsStr(trimmed, "Active:") {
			parts := splitAfter(trimmed, "Active:")
			if len(parts) > 1 {
				status.Active = trimSpace(parts[1])
			}
		}
		if containsStr(trimmed, "Loaded:") {
			parts := splitAfter(trimmed, "Loaded:")
			if len(parts) > 1 {
				status.LoadState = trimSpace(parts[1])
			}
		}
	}

	if status.Active == "" {
		status.Active = "inactive"
	}

	cacheMutex.Lock()
	serviceCacheVal[name] = serviceCacheEntry{
		status:    status,
		timestamp: time.Now(),
	}
	cacheMutex.Unlock()

	return status, nil
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && findIndex(s, substr) >= 0
}

func findIndex(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func splitAfter(s, sep string) []string {
	idx := findIndex(s, sep)
	if idx < 0 {
		return []string{s}
	}
	return []string{s[:idx], s[idx+len(sep):]}
}
