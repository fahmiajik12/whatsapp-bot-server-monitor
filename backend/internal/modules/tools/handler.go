package tools

import (
"net/http"
"sort"

"github.com/go-chi/chi/v5"

"wabot-backend/internal/executor"
"wabot-backend/internal/model"
)

func HandleExec(w http.ResponseWriter, r *http.Request) {
name := chi.URLParam(r, "name")

if name == "" {
model.SendError(w, http.StatusBadRequest, "nama command diperlukan")
return
}

output, err := RunTool(name)
if err != nil {
model.SendError(w, http.StatusInternalServerError, err.Error())
return
}

model.SendSuccess(w, map[string]string{
"command": name,
"output":  output,
})
}

func HandleList(w http.ResponseWriter, r *http.Request) {
tools := ListTools()
sort.Strings(tools)
model.SendSuccess(w, tools)
}

func HandleReboot(w http.ResponseWriter, r *http.Request) {
output, err := executor.RunCommand("sudo", "systemctl", "reboot")
if err != nil {
model.SendError(w, http.StatusInternalServerError, err.Error())
return
}

model.SendSuccess(w, map[string]string{
"status": "rebooting",
"output": output,
})
}
