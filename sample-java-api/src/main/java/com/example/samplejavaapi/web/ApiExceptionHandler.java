package com.example.samplejavaapi.web;

import com.example.samplejavaapi.userprofile.SimulatedProfileErrorException;
import com.example.samplejavaapi.userprofile.SimulatedProfileWarningException;
import com.example.samplejavaapi.userprofile.UserProfileNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Turns API exceptions into small, predictable JSON error bodies. */
@RestControllerAdvice
public class ApiExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(UserProfileNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(UserProfileNotFoundException ex) {
    return error(HttpStatus.NOT_FOUND, ex.getMessage());
  }

  /**
   * The exception is passed to the logger, so the file gets a stack trace as a real failure
   * would - which is also why the Agent needs a multiline rule to ship these as one event.
   */
  @ExceptionHandler(SimulatedProfileErrorException.class)
  public ResponseEntity<Map<String, Object>> handleSimulatedError(
      SimulatedProfileErrorException ex) {
    log.error("getUserProfile failed: {}", ex.getMessage(), ex);
    return error(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage());
  }

  /** No stack trace here: a warning is an expected, handled outcome rather than a fault. */
  @ExceptionHandler(SimulatedProfileWarningException.class)
  public ResponseEntity<Map<String, Object>> handleSimulatedWarning(
      SimulatedProfileWarningException ex) {
    log.warn("getUserProfile rejected: {}", ex.getMessage());
    return error(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
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
