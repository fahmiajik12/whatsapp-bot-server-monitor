package process

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"wabot-backend/internal/model"
)

func HandleKill(w http.ResponseWriter, r *http.Request) {
	pid := chi.URLParam(r, "pid")

	if pid == "" {
		model.SendError(w, http.StatusBadRequest, "PID diperlukan")
		return
	}

	result, err := Kill(pid)
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	model.SendSuccess(w, map[string]string{
		"pid":    pid,
		"result": result,
	})
}
