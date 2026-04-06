package service

import (
	"wabot-backend/internal/executor"
	"wabot-backend/internal/model"
	"wabot-backend/internal/modules/monitoring"
)

func GetStatus(name string) (*model.ServiceStatus, error) {
	return monitoring.GetServiceStatus(name)
}

func StartService(name string) (string, error) {
	return executor.RunSystemctl("start", name)
}

func StopService(name string) (string, error) {
	return executor.RunSystemctl("stop", name)
}

func RestartService(name string) (string, error) {
	return executor.RunSystemctl("restart", name)
}
