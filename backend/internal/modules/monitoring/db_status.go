package monitoring

import (
	"context"
	"net"
	"os/exec"
	"strings"
	"time"
	"wabot-backend/internal/model"
)

func GetDBStatus() model.DBStatus {
	return model.DBStatus{
		MySQL:      checkServiceActive("mysql") || checkPortOpen("3306"),
		PostgreSQL: checkServiceActive("postgresql") || checkPortOpen("5432"),
		Redis:      checkServiceActive("redis") || checkPortOpen("6379"),
	}
}

func checkServiceActive(name string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "systemctl", "is-active", name)
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(output)) == "active"
}

func checkPortOpen(port string) bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:"+port, 1*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
