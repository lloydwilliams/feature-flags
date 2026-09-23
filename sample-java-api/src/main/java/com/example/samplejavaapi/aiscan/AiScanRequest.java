package com.example.samplejavaapi.aiscan;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Body of a StartAIScan call.
 *
 * <p>{@code email} and {@code site} are the flag evaluation context, the same pair getUserProfile
 * takes. Both are required here rather than optional: the flag targets on site, and the response
 * names the site back to the caller, so there is no sensible behaviour without it.
 *
 * <p>Amount bounds mirror the validation sample-react applies before it ever calls: a whole number
 * below 1000. Checked again here because a client-side rule is a convenience, not a guarantee.
 */
public record AiScanRequest(
    @NotNull(message = "amount is required")
        @Min(value = 0, message = "amount must be 0 or greater")
        @Max(value = 999, message = "amount must be less than 1000")
        Integer amount,
    @NotBlank(message = "email is required") @Email(message = "must be a valid email address")
        String email,
    @NotBlank(message = "site is required") String site) {}
