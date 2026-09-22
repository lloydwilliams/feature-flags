package com.example.samplejavaapi.web;

import com.example.samplejavaapi.userprofile.UserProfileNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Turns API exceptions into small, predictable JSON error bodies. */
@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(UserProfileNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(UserProfileNotFoundException ex) {
    return error(HttpStatus.NOT_FOUND, ex.getMessage());
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<Map<String, Object>> handleInvalidParam(ConstraintViolationException ex) {
    String message =
        ex.getConstraintViolations().stream()
            .map(ConstraintViolation::getMessage)
            .collect(Collectors.joining("; "));
    return error(HttpStatus.BAD_REQUEST, message.isBlank() ? "Invalid request" : message);
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<Map<String, Object>> handleMissingParam(
      MissingServletRequestParameterException ex) {
    return error(HttpStatus.BAD_REQUEST, "Missing required parameter '" + ex.getParameterName() + "'");
  }

  private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
    return ResponseEntity.status(status)
        .body(Map.of("status", status.value(), "error", status.getReasonPhrase(), "message", message));
  }
}
