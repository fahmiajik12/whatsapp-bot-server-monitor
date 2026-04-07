package audit

import (
	"bufio"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"

	"wabot-backend/internal/model"
)

type AuditService struct {
	mu      sync.Mutex
	logFile string
}

var auditInstance *AuditService
var auditOnce sync.Once

func GetService() *AuditService {
	auditOnce.Do(func() {
		dataDir := filepath.Join(".", "data")
		os.MkdirAll(dataDir, 0755)

		auditInstance = &AuditService{
			logFile: filepath.Join(dataDir, "audit.jsonl"),
		}
	})
	return auditInstance
}

func (s *AuditService) Log(entry model.AuditEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(s.logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write(append(data, '\n'))
	return err
}

func (s *AuditService) Query(count int) []model.AuditEntry {
	s.mu.Lock()
	defer s.mu.Unlock()

	f, err := os.Open(s.logFile)
	if err != nil {
		return nil
	}
	defer f.Close()

	var entries []model.AuditEntry
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		var entry model.AuditEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[WARN] Audit scan error: %v", err)
	}

	if len(entries) > count {
		entries = entries[len(entries)-count:]
	}

	return entries
}

func (s *AuditService) QueryByUser(user string, count int) []model.AuditEntry {
	all := s.Query(count * 3)

	var filtered []model.AuditEntry
	for _, e := range all {
		if e.User == user {
			filtered = append(filtered, e)
		}
	}

	if len(filtered) > count {
		filtered = filtered[len(filtered)-count:]
	}

	return filtered
}
