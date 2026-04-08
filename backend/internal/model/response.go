package model

import (
	"encoding/json"
	"net/http"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type SystemStatus struct {
	CPU          float64         `json:"cpu"`
	RAM          RAMInfo         `json:"ram"`
	Swap         SwapInfo        `json:"swap"`
	Disk         DiskInfo        `json:"disk"`
	GPU          GPUInfo         `json:"gpu"`
	Temperatures TemperatureInfo `json:"temperatures"`
	Uptime       string          `json:"uptime"`
	Database     DBStatus        `json:"database"`
	Network      []NetworkInterface `json:"network"`
}

type TemperatureInfo struct {
	CPU  float64 `json:"cpu"`
	GPU  float64 `json:"gpu"`
	RAM  float64 `json:"ram,omitempty"`
	Disk float64 `json:"disk,omitempty"`
}

type DBStatus struct {
	MySQL      bool `json:"mysql"`
	PostgreSQL bool `json:"postgresql"`
	Redis      bool `json:"redis"`
}

type RAMInfo struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"usedPercent"`
}

type SwapInfo struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"usedPercent"`
}

type GPUInfo struct {
	Name        string  `json:"name"`
	BusyPercent float64 `json:"busyPercent"`
	VRAMTotal   uint64  `json:"vramTotal"`
	VRAMUsed    uint64  `json:"vramUsed"`
	VRAMFree    uint64  `json:"vramFree"`
	VRAMPercent float64 `json:"vramPercent"`
}

type DiskInfo struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"usedPercent"`
}

type NetworkInterface struct {
	Name    string  `json:"name"`
	RxBytes uint64  `json:"rxBytes"`
	TxBytes uint64  `json:"txBytes"`
	RxSpeed float64 `json:"rxSpeed"`
	TxSpeed float64 `json:"txSpeed"`
}

type ServiceStatus struct {
	Name      string `json:"name"`
	Active    string `json:"active"`
	SubState  string `json:"subState"`
	LoadState string `json:"loadState"`
}

type ApacheVHost struct {
	ServerName   string `json:"serverName"`
	Port         string `json:"port"`
	DocumentRoot string `json:"documentRoot"`
}

type LogEntry struct {
	Lines []string `json:"lines"`
	Count int      `json:"count"`
}

func SendSuccess(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    data,
	})
}

func SendError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(APIResponse{
		Success: false,
		Error:   message,
	})
}
