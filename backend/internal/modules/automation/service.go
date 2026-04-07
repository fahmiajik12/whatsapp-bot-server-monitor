package automation

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"wabot-backend/internal/executor"
	"wabot-backend/internal/model"
	"wabot-backend/internal/modules/monitoring"
)

type AutomationEngine struct {
	mu                sync.RWMutex
	rules             []model.AutomationRule
	history           []model.AutomationHistory
	rulesFile         string
	historyFile       string
	ticker            *time.Ticker
	stopCh            chan struct{}
	conditionCounts   map[string]int
	maxHistorySize    int
	maxActionsPerHour int
	actionsThisHour   int
	hourReset         time.Time
}

var engineInstance *AutomationEngine
var engineOnce sync.Once

func GetEngine() *AutomationEngine {
	engineOnce.Do(func() {
		dataDir := filepath.Join(".", "data")
		os.MkdirAll(dataDir, 0755)

		engineInstance = &AutomationEngine{
			rulesFile:         filepath.Join(dataDir, "automation_rules.json"),
			historyFile:       filepath.Join(dataDir, "automation_history.json"),
			stopCh:            make(chan struct{}),
			conditionCounts:   make(map[string]int),
			maxHistorySize:    1000,
			maxActionsPerHour: 10,
			hourReset:         time.Now(),
		}
		engineInstance.loadRules()
		engineInstance.loadHistory()
	})
	return engineInstance
}

func (e *AutomationEngine) SetMaxActionsPerHour(max int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.maxActionsPerHour = max
}

func (e *AutomationEngine) Start(intervalSeconds int) {
	if intervalSeconds <= 0 {
		intervalSeconds = 30
	}
	e.ticker = time.NewTicker(time.Duration(intervalSeconds) * time.Second)

	go func() {
		for {
			select {
			case <-e.ticker.C:
				e.evaluate()
			case <-e.stopCh:
				return
			}
		}
	}()
	log.Printf("[INFO] Automation engine dimulai (interval: %ds, rules: %d)", intervalSeconds, len(e.rules))
}

func (e *AutomationEngine) Stop() {
	if e.ticker != nil {
		e.ticker.Stop()
	}
	select {
	case <-e.stopCh:
	default:
		close(e.stopCh)
	}
}

func (e *AutomationEngine) GetRules() []model.AutomationRule {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]model.AutomationRule, len(e.rules))
	copy(result, e.rules)
	return result
}

func (e *AutomationEngine) UpdateRule(id string, enabled bool) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for i := range e.rules {
		if e.rules[i].ID == id {
			e.rules[i].Enabled = enabled
			e.saveRulesUnlocked()
			return nil
		}
	}
	return fmt.Errorf("rule '%s' tidak ditemukan", id)
}

func (e *AutomationEngine) GetHistory() []model.AutomationHistory {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]model.AutomationHistory, len(e.history))
	copy(result, e.history)
	return result
}

func (e *AutomationEngine) evaluate() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if time.Since(e.hourReset) > time.Hour {
		e.actionsThisHour = 0
		e.hourReset = time.Now()
	}

	if e.actionsThisHour >= e.maxActionsPerHour {
		return
	}

	for i := range e.rules {
		rule := &e.rules[i]
		if !rule.Enabled {
			continue
		}

		if !rule.LastRun.IsZero() {
			elapsed := time.Since(rule.LastRun)
			if elapsed < time.Duration(rule.CooldownSeconds)*time.Second {
				continue
			}
		}

		triggered, err := e.checkCondition(rule.Condition)
		if err != nil {
			log.Printf("[WARN] Automation kondisi check gagal (%s): %v", rule.ID, err)
			continue
		}

		if !triggered {
			delete(e.conditionCounts, rule.ID)
			continue
		}

		if rule.Condition.Duration > 0 {
			e.conditionCounts[rule.ID]++
			if e.conditionCounts[rule.ID] < rule.Condition.Duration {
				continue
			}
		}

		log.Printf("[AUTO] Rule '%s' triggered — menjalankan aksi: %s %s", rule.ID, rule.Action.Type, rule.Action.Target)

		err = e.executeAction(rule.Action)
		success := err == nil

		rule.LastRun = time.Now()
		rule.RunCount++
		e.actionsThisHour++
		delete(e.conditionCounts, rule.ID)

		entry := model.AutomationHistory{
			Timestamp: time.Now().Format(time.RFC3339),
			RuleID:    rule.ID,
			RuleName:  rule.Name,
			Action:    fmt.Sprintf("%s %s", rule.Action.Type, rule.Action.Target),
			Success:   success,
		}
		if err != nil {
			entry.Error = err.Error()
			log.Printf("[AUTO] Rule '%s' gagal: %v", rule.ID, err)
		} else {
			log.Printf("[AUTO] Rule '%s' berhasil dijalankan", rule.ID)
		}

		e.history = append(e.history, entry)
		if len(e.history) > e.maxHistorySize {
			e.history = e.history[len(e.history)-e.maxHistorySize:]
		}
	}

	e.saveRulesUnlocked()
	e.saveHistoryUnlocked()
}

func (e *AutomationEngine) checkCondition(cond model.Condition) (bool, error) {
	switch cond.Type {
	case "service_down":
		status, err := monitoring.GetServiceStatus(cond.Target)
		if err != nil {
			return false, err
		}
		isRunning := false
		if status.Active != "" {
			for i := 0; i <= len(status.Active)-len("running"); i++ {
				if status.Active[i:i+len("running")] == "running" {
					isRunning = true
					break
				}
			}
		}
		return !isRunning, nil

	case "cpu_above":
		sys, err := monitoring.GetSystemStatus()
		if err != nil {
			return false, err
		}
		return sys.CPU > cond.Threshold, nil

	case "ram_above":
		sys, err := monitoring.GetSystemStatus()
		if err != nil {
			return false, err
		}
		return sys.RAM.UsedPercent > cond.Threshold, nil

	case "disk_above":
		sys, err := monitoring.GetSystemStatus()
		if err != nil {
			return false, err
		}
		return sys.Disk.UsedPercent > cond.Threshold, nil

	default:
		return false, fmt.Errorf("kondisi tidak dikenal: %s", cond.Type)
	}
}

func (e *AutomationEngine) executeAction(action model.Action) error {
	switch action.Type {
	case "restart_service":
		_, err := executor.RunSystemctl("restart", action.Target)
		return err

	case "cleanup_logs":
		_, err := executor.RunCommand("find", action.Target, "-name", "*.log", "-mtime", "+7", "-delete")
		return err

	case "send_alert":
		log.Printf("[AUTO-ALERT] Triggered alert untuk kondisi")
		return nil

	case "run_command":
		_, err := executor.RunCommand("bash", "-c", action.Target)
		return err

	default:
		return fmt.Errorf("aksi tidak dikenal: %s", action.Type)
	}
}

func (e *AutomationEngine) loadRules() {
	data, err := os.ReadFile(e.rulesFile)
	if err != nil {
		e.rules = defaultRules()
		e.saveRulesUnlocked()
		return
	}

	if err := json.Unmarshal(data, &e.rules); err != nil {
		log.Printf("[WARN] Gagal load automation rules: %v", err)
		e.rules = defaultRules()
	}

	log.Printf("[INFO] %d automation rules dimuat", len(e.rules))
}

func (e *AutomationEngine) loadHistory() {
	data, err := os.ReadFile(e.historyFile)
	if err != nil {
		return
	}
	if err := json.Unmarshal(data, &e.history); err != nil {
		log.Printf("[WARN] Gagal load automation history: %v", err)
	}
}

func (e *AutomationEngine) saveRulesUnlocked() {
	data, err := json.MarshalIndent(e.rules, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(e.rulesFile, data, 0644)
}

func (e *AutomationEngine) saveHistoryUnlocked() {
	data, err := json.Marshal(e.history)
	if err != nil {
		return
	}
	os.WriteFile(e.historyFile, data, 0644)
}

func defaultRules() []model.AutomationRule {
	return []model.AutomationRule{
		{
			ID:      "apache-auto-restart",
			Name:    "Auto-restart Apache jika down",
			Enabled: false,
			Condition: model.Condition{
				Type:   "service_down",
				Target: "apache2",
			},
			Action: model.Action{
				Type:   "restart_service",
				Target: "apache2",
			},
			CooldownSeconds: 300,
		},
		{
			ID:      "disk-cleanup",
			Name:    "Cleanup log jika disk > 95%",
			Enabled: false,
			Condition: model.Condition{
				Type:      "disk_above",
				Threshold: 95,
			},
			Action: model.Action{
				Type:   "cleanup_logs",
				Target: "/var/log",
			},
			CooldownSeconds: 3600,
		},
	}
}
