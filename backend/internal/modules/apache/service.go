package apache

import (
	"strings"

	"wabot-backend/internal/executor"
	"wabot-backend/internal/model"
)

func GetStatus() (*model.ServiceStatus, error) {
	output, _ := executor.RunSystemctl("status", "apache2")

	status := &model.ServiceStatus{
		Name: "apache2",
	}

	for _, line := range strings.Split(output, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Active:") {
			status.Active = strings.TrimPrefix(trimmed, "Active: ")
		}
		if strings.HasPrefix(trimmed, "Loaded:") {
			status.LoadState = strings.TrimPrefix(trimmed, "Loaded: ")
		}
	}

	if status.Active == "" {
		status.Active = "inactive"
	}

	return status, nil
}

func Restart() (string, error) {
	return executor.RunSystemctl("restart", "apache2")
}

func Reload() (string, error) {
	return executor.RunSystemctl("reload", "apache2")
}

func ConfigTest() (string, error) {
	return executor.RunCommand("apachectl", "configtest")
}

func GetVHosts() (string, error) {
	return executor.RunCommand("apachectl", "-S")
}
