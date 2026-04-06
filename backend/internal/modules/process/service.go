package process

import (
	"wabot-backend/internal/executor"
)

func Kill(pid string) (string, error) {
	return executor.KillProcess(pid)
}
