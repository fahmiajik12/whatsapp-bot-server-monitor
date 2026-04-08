package monitoring

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"wabot-backend/internal/model"
)

var (
	netStatsCache map[string]netStatEntry
	netStatsMutex sync.Mutex
)

type netStatEntry struct {
	rxBytes   uint64
	txBytes   uint64
	timestamp time.Time
}

func init() {
	netStatsCache = make(map[string]netStatEntry)
}

func GetNetworkStats() []model.NetworkInterface {
	netStatsMutex.Lock()
	defer netStatsMutex.Unlock()

	var interfaces []model.NetworkInterface
	now := time.Now()

	entries, err := os.ReadDir("/sys/class/net")
	if err != nil {
		return interfaces
	}

	for _, entry := range entries {
		name := entry.Name()
		if name == "lo" || strings.HasPrefix(name, "veth") || strings.HasPrefix(name, "docker") || strings.HasPrefix(name, "br-") {
			continue
		}

		rxBytes := readNetworkStat(name, "rx_bytes")
		txBytes := readNetworkStat(name, "tx_bytes")

		var rxSpeed, txSpeed float64
		
		if prev, ok := netStatsCache[name]; ok {
			duration := now.Sub(prev.timestamp).Seconds()
			if duration > 0 {
				if rxBytes >= prev.rxBytes {
					rxSpeed = float64(rxBytes-prev.rxBytes) / duration
				}
				if txBytes >= prev.txBytes {
					txSpeed = float64(txBytes-prev.txBytes) / duration
				}
			}
		}

		netStatsCache[name] = netStatEntry{
			rxBytes:   rxBytes,
			txBytes:   txBytes,
			timestamp: now,
		}

		interfaces = append(interfaces, model.NetworkInterface{
			Name:    name,
			RxBytes: rxBytes,
			TxBytes: txBytes,
			RxSpeed: rxSpeed,
			TxSpeed: txSpeed,
		})
	}

	return interfaces
}

func readNetworkStat(iface, stat string) uint64 {
	path := filepath.Join("/sys/class/net", iface, "statistics", stat)
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
