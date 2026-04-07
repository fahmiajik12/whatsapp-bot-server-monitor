package automation

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"wabot-backend/internal/model"
)

func HandleGetRules(w http.ResponseWriter, r *http.Request) {
	engine := GetEngine()
	rules := engine.GetRules()
	model.SendSuccess(w, rules)
}

func HandleUpdateRule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		model.SendError(w, http.StatusBadRequest, "Rule ID diperlukan")
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		model.SendError(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}

	engine := GetEngine()
	if err := engine.UpdateRule(id, req.Enabled); err != nil {
		model.SendError(w, http.StatusNotFound, err.Error())
		return
	}

	status := "diaktifkan"
	if !req.Enabled {
		status = "dinonaktifkan"
	}

	model.SendSuccess(w, map[string]string{
		"message": "Rule '" + id + "' telah " + status,
	})
}

func HandleGetHistory(w http.ResponseWriter, r *http.Request) {
	engine := GetEngine()
	history := engine.GetHistory()
	model.SendSuccess(w, history)
}

func HandleEvaluate(w http.ResponseWriter, r *http.Request) {
	engine := GetEngine()
	engine.evaluate()
	model.SendSuccess(w, map[string]string{
		"message": "Evaluasi automation selesai",
	})
}
