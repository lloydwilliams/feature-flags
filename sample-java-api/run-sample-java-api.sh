#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Start the Spring Boot app on http://localhost:8080
mvn spring-boot:run
