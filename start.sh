#!/usr/bin/env bash
# StockSense Launch Script
# Starts the local Python server with SQLite database and opens the application

cd "$(dirname "$0")"

echo "=========================================================="
echo "  Starting StockSense Inventory Management System...      "
echo "=========================================================="
echo ""
echo "  Application URL: http://localhost:8000                  "
echo "  REST API:        http://localhost:8000/api/products     "
echo "  Local Database:  stocksense.db                          "
echo ""
echo "Press Ctrl+C to stop the server."
echo "=========================================================="

python3 server.py
