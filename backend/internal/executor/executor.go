package executor

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"wabot-backend/config"
)

const defaultTimeout = 10 * time.Second

func RunSystemctl(action, service string) (string, error) {
	if !config.AppConfig.IsServiceAllowed(service) {
		return "", fmt.Errorf("service '%s' tidak diizinkan", service)
	}

	allowedActions := map[string]bool{
		"status":  true,
		"start":   true,
		"stop":    true,
		"restart": true,
		"reload":  true,
	}
	if !allowedActions[action] {
		return "", fmt.Errorf("action '%s' tidak diizinkan", action)
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "systemctl", action, service)
	output, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("command timeout setelah %v", defaultTimeout)
	}

	if err != nil && action != "status" {
		return string(output), fmt.Errorf("gagal menjalankan systemctl %s %s: %v", action, service, err)
	}

	return string(output), nil
}

func RunCommand(name string, args ...string) (string, error) {
	for _, arg := range args {
		if strings.ContainsAny(arg, ";|&`$(){}[]!#") {
			return "", fmt.Errorf("karakter tidak diizinkan dalam argumen: %s", arg)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("command timeout setelah %v", defaultTimeout)
	}

	if err != nil {
		return string(output), fmt.Errorf("gagal menjalankan %s: %v\nOutput: %s", name, err, string(output))
	}

	return string(output), nil
}

func RunJournalctl(service string, lines int) (string, error) {
	if !config.AppConfig.IsServiceAllowed(service) {
		return "", fmt.Errorf("service '%s' tidak diizinkan", service)
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "journalctl",
		"-u", service,
		"-n", fmt.Sprintf("%d", lines),
		"--no-pager",
		"--output", "short-iso",
	)
	output, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("command timeout setelah %v", defaultTimeout)
	}

	if err != nil {
		return string(output), fmt.Errorf("gagal membaca log %s: %v", service, err)
	}

	return string(output), nil
}

func KillProcess(pid string) (string, error) {
	for _, c := range pid {
		if c < '0' || c > '9' {
			return "", fmt.Errorf("PID harus berupa angka")
		}
	}

	if pid == "0" || pid == "1" || pid == "2" {
		return "", fmt.Errorf("tidak boleh kill PID sistem (%s)", pid)
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "kill", "-15", pid)
	output, err := cmd.CombinedOutput()

	if err != nil {
		return string(output), fmt.Errorf("gagal kill PID %s: %v", pid, err)
	}

	return fmt.Sprintf("Proses %s berhasil dihentikan", pid), nil
}
