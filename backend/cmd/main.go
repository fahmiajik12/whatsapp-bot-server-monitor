package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"wabot-backend/config"
	"wabot-backend/internal/server"
)

func main() {
	log.Println("[START] Wabot Backend Starting...")

	configPath := "config.json"
	if envPath := os.Getenv("CONFIG_PATH"); envPath != "" {
		configPath = envPath
	}

	if err := config.Load(configPath); err != nil {
		log.Printf("[WARN] Gagal load config dari %s, menggunakan default: %v", configPath, err)
	}

	log.Printf("[INFO] Port: %s", config.AppConfig.Port)
	log.Printf("[INFO] Service whitelist: %v", config.AppConfig.AllowedServices)

	router := server.NewRouter()

	srv := &http.Server{
		Addr:         config.AppConfig.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[OK] Server berjalan di http://localhost%s", config.AppConfig.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[ERR] Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[STOP] Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[ERR] Server forced to shutdown: %v", err)
	}

	log.Println("[STOP] Server stopped")
}
