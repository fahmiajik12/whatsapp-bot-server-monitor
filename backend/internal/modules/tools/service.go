package tools

import (
"context"
"fmt"
"os/exec"
"strings"
"time"
)

var allowedCommands = map[string][]string{
"pm2-status":     {"pm2", "list"},
"pm2-logs":       {"pm2", "logs", "--nostream", "--lines", "30"},
"docker-ps":      {"docker", "ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"},
"docker-ps-all":  {"docker", "ps", "-a", "--format", "table {{.Names}}\t{{.Status}}\t{{.Image}}"},
"docker-images":  {"docker", "images", "--format", "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"},
"docker-stats":   {"docker", "stats", "--no-stream", "--format", "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"},
"docker-compose": {"docker", "compose", "ps"},
"df":             {"df", "-h", "--total"},
"free":           {"free", "-h"},
"uptime":         {"uptime"},
"who":            {"who"},
"top":            {"top", "-b", "-n", "1", "-o", "%CPU"},
"ss":             {"ss", "-tulnp"},
"ip":             {"ip", "-br", "addr"},
"uname":          {"uname", "-a"},
"last":           {"last", "-n", "10"},
"netstat":        {"ss", "-s"},
"temp":           {"sensors"},
}

func RunTool(name string) (string, error) {
args, ok := allowedCommands[name]
if !ok {
return "", fmt.Errorf("command '%s' tidak tersedia", name)
}

ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()

cmd := exec.CommandContext(ctx, args[0], args[1:]...)
output, err := cmd.CombinedOutput()

if ctx.Err() == context.DeadlineExceeded {
return "", fmt.Errorf("command timeout")
}

result := strings.TrimSpace(string(output))

if err != nil && result == "" {
return "", fmt.Errorf("gagal menjalankan %s: %v", name, err)
}

return result, nil
}

func ListTools() []string {
var names []string
for name := range allowedCommands {
names = append(names, name)
}
return names
}
