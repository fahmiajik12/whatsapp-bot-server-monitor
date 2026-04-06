package model

import "time"

type AuditEntry struct {
	Timestamp  string `json:"timestamp"`
	User       string `json:"user"`
	Role       string `json:"role"`
	Command    string `json:"command"`
	Server     string `json:"server"`
	Result     string `json:"result"`
	DurationMs int64  `json:"duration_ms"`
	Error      string `json:"error,omitempty"`
}

type Baseline struct {
	CPU         BaselineMetric `json:"cpu"`
	RAM         BaselineMetric `json:"ram"`
	Disk        BaselineMetric `json:"disk"`
	SampleCount int            `json:"sampleCount"`
	WindowSize  int            `json:"windowSize"`
}

type BaselineMetric struct {
	Average float64 `json:"average"`
	StdDev  float64 `json:"stddev"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
}

type Anomaly struct {
	Type        string   `json:"type"`
	Severity    string   `json:"severity"`
	Value       float64  `json:"value"`
	Baseline    float64  `json:"baseline"`
	Message     string   `json:"message"`
	Suggestions []string `json:"suggestions"`
}

type TrendData struct {
	DiskPrediction *DiskPrediction `json:"diskPrediction,omitempty"`
	CPUTrend       *TrendInfo      `json:"cpuTrend,omitempty"`
	RAMTrend       *TrendInfo      `json:"ramTrend,omitempty"`
}

type DiskPrediction struct {
	DaysUntilFull int     `json:"daysUntilFull"`
	GrowthPerDay  float64 `json:"growthPerDay"`
}

type TrendInfo struct {
	Direction string  `json:"direction"`
	Average   float64 `json:"average"`
}

type AutomationRule struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Enabled         bool      `json:"enabled"`
	Condition       Condition `json:"condition"`
	Action          Action    `json:"action"`
	CooldownSeconds int       `json:"cooldownSeconds"`
	LastRun         time.Time `json:"lastRun"`
	RunCount        int       `json:"runCount"`
}

type Condition struct {
	Type      string  `json:"type"`
	Target    string  `json:"target"`
	Threshold float64 `json:"threshold"`
	Duration  int     `json:"duration"`
}

type Action struct {
	Type   string `json:"type"`
	Target string `json:"target"`
}

type AutomationHistory struct {
	Timestamp string `json:"timestamp"`
	RuleID    string `json:"ruleId"`
	RuleName  string `json:"ruleName"`
	Action    string `json:"action"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
}
