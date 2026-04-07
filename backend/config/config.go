package config

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

type Config struct {
	Port            string           `json:"port"`
	APIKey          string           `json:"apiKey"`
	AllowedServices []string         `json:"allowedServices"`
	LogTailLines    int              `json:"logTailLines"`
	Monitoring      MonitoringConfig `json:"monitoring"`
	Automation      AutomationConfig `json:"automation"`
	Security        SecurityConfig   `json:"security"`
}

type MonitoringConfig struct {
	BaselineWindow          int     `json:"baselineWindow"`
	BaselineSamplingSeconds int     `json:"baselineSamplingSeconds"`
	SpikeMultiplier         float64 `json:"spikeMultiplier"`
	TrendPredictionDays     int     `json:"trendPredictionDays"`
}

type AutomationConfig struct {
	Enabled                   bool `json:"enabled"`
	EvaluationIntervalSeconds int  `json:"evaluationIntervalSeconds"`
	MaxActionsPerHour         int  `json:"maxActionsPerHour"`
}

type SecurityConfig struct {
	RateLimitPerMinute int  `json:"rateLimitPerMinute"`
	AuditEnabled       bool `json:"auditEnabled"`
}

var AppConfig *Config

func Load(path string) error {
	AppConfig = &Config{}

	file, err := os.Open(path)
	if err == nil {
		defer file.Close()
		json.NewDecoder(file).Decode(AppConfig)
	}

	if env := os.Getenv("WABOT_PORT"); env != "" {
		AppConfig.Port = env
	}
	if AppConfig.Port == "" {
		AppConfig.Port = ":8080"
	}

	if env := os.Getenv("WABOT_API_KEY"); env != "" {
		AppConfig.APIKey = env
	}
	if AppConfig.APIKey == "" || AppConfig.APIKey == "CHANGE-ME-your-secret-api-key" {
		AppConfig.APIKey = generateRandomKey()
		log.Printf("[WARN] API key tidak dikonfigurasi, menggunakan random key: %s", AppConfig.APIKey)
	}

	if AppConfig.LogTailLines == 0 {
		AppConfig.LogTailLines = 50
	}

	if len(AppConfig.AllowedServices) == 0 {
		AppConfig.AllowedServices = detectRunningServices()
		log.Printf("[INFO] Auto-detect %d services dari sistem", len(AppConfig.AllowedServices))
	}

	if AppConfig.Monitoring.BaselineWindow == 0 {
		AppConfig.Monitoring.BaselineWindow = 60
	}
	if AppConfig.Monitoring.BaselineSamplingSeconds == 0 {
		AppConfig.Monitoring.BaselineSamplingSeconds = 60
	}
	if AppConfig.Monitoring.SpikeMultiplier == 0 {
		AppConfig.Monitoring.SpikeMultiplier = 1.5
	}
	if AppConfig.Monitoring.TrendPredictionDays == 0 {
		AppConfig.Monitoring.TrendPredictionDays = 7
	}

	if AppConfig.Automation.EvaluationIntervalSeconds == 0 {
		AppConfig.Automation.EvaluationIntervalSeconds = 30
	}
	if AppConfig.Automation.MaxActionsPerHour == 0 {
		AppConfig.Automation.MaxActionsPerHour = 10
	}

	if AppConfig.Security.RateLimitPerMinute == 0 {
		AppConfig.Security.RateLimitPerMinute = 60
	}

	return nil
}

func (c *Config) IsServiceAllowed(name string) bool {
	normalized := strings.TrimSuffix(name, ".service")
	for _, s := range c.AllowedServices {
		sNorm := strings.TrimSuffix(s, ".service")
		if sNorm == normalized {
			return true
		}
	}
	return false
}

func detectRunningServices() []string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "systemctl", "list-units",
		"--type=service",
		"--state=running",
		"--no-pager",
		"--no-legend",
	)

	output, err := cmd.Output()
	if err != nil {
		return defaultServices()
	}

	var services []string
	skip := map[string]bool{
		"dbus.service":                true,
		"getty@tty1.service":          true,
		"systemd-journald.service":    true,
		"systemd-logind.service":      true,
		"systemd-networkd.service":    true,
		"systemd-resolved.service":    true,
		"systemd-timesyncd.service":   true,
		"systemd-udevd.service":       true,
		"polkit.service":              true,
		"irqbalance.service":          true,
		"multipathd.service":          true,
		"networkd-dispatcher.service": true,
		"unattended-upgrades.service": true,
		"packagekit.service":          true,
		"udisks2.service":             true,
		"upower.service":              true,
		"ModemManager.service":        true,
		"smartmontools.service":       true,
		"snapd.service":               true,
		"rsyslog.service":             true,
		"cron.service":                true,
	}

	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		svcName := fields[0]
		if skip[svcName] {
			continue
		}
		if strings.HasPrefix(svcName, "user@") {
			continue
		}
		clean := strings.TrimSuffix(svcName, ".service")
		services = append(services, clean)
	}

	if len(services) == 0 {
		return defaultServices()
	}

	return services
}

func defaultServices() []string {
	return []string{
		"apache2",
		"nginx",
		"mysql",
		"postgresql",
		"docker",
		"redis-server",
		"ssh",
	}
}

func generateRandomKey() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return fmt.Sprintf("wabot-%s", hex.EncodeToString(bytes))
}
