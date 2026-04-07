package monitoring

import (
	"net/http"

	"wabot-backend/internal/model"
)

func HandleBaseline(w http.ResponseWriter, r *http.Request) {
	engine := GetBaselineEngine()
	baseline := engine.GetBaseline()
	model.SendSuccess(w, baseline)
}

func HandleAnomalies(w http.ResponseWriter, r *http.Request) {
	status, err := GetSystemStatus()
	if err != nil {
		model.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	engine := GetBaselineEngine()
	spikeMultiplier := 1.5

	anomalies := engine.DetectAnomalies(status, spikeMultiplier)
	if anomalies == nil {
		anomalies = []model.Anomaly{}
	}

	model.SendSuccess(w, anomalies)
}

func HandleTrends(w http.ResponseWriter, r *http.Request) {
	engine := GetBaselineEngine()
	trends := engine.GetTrends()
	model.SendSuccess(w, trends)
}

func HandleBaselineReset(w http.ResponseWriter, r *http.Request) {
	engine := GetBaselineEngine()
	engine.Reset()
	model.SendSuccess(w, map[string]string{
		"message": "Baseline data berhasil di-reset",
	})
}
