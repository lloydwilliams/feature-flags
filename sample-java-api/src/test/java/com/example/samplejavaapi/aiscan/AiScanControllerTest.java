package com.example.samplejavaapi.aiscan;

import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.samplejavaapi.flags.FeatureFlags;
import dev.openfeature.sdk.FlagEvaluationDetails;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The flag provider cannot initialize in tests (no agent), so FeatureFlags is mocked to exercise
 * both sides of the gate rather than only the default-off one.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AiScanControllerTest {

  private static final String BODY =
      """
      {"amount": 42, "email": "lloyd.williams@datadoghq.com", "site": "Toronto"}
      """;

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FeatureFlags featureFlags;

  private void flagReturns(boolean value) {
    when(featureFlags.booleanDetails(anyString(), anyBoolean(), anyString(), anyString()))
        .thenReturn(FlagEvaluationDetails.<Boolean>builder().value(value).reason("STATIC").build());
  }

  /** A percentage rollout: reason SPLIT, with the bucket named in variant. */
  private void flagReturnsFromRollout(boolean value, String variant) {
    when(featureFlags.booleanDetails(anyString(), anyBoolean(), anyString(), anyString()))
        .thenReturn(
            FlagEvaluationDetails.<Boolean>builder()
                .value(value)
                .reason("SPLIT")
                .variant(variant)
                .build());
  }

  @Test
  void runsTheScanWhenTheFlagIsOnForTheSite() throws Exception {
    flagReturns(true);

    mockMvc
        .perform(post("/api/ai-scan/start").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(true))
        .andExpect(jsonPath("$.site").value("Toronto"))
        .andExpect(jsonPath("$.amount").value(42))
        .andExpect(jsonPath("$.message").value("AI Scan Successful at site: Toronto"));
  }

  @Test
  void reportsTheEvaluationReasonAndRolloutVariant() throws Exception {
    flagReturnsFromRollout(true, "on-40-percent");

    mockMvc
        .perform(post("/api/ai-scan/start").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(true))
        .andExpect(jsonPath("$.reason").value("SPLIT"))
        .andExpect(jsonPath("$.variant").value("on-40-percent"));
  }

  @Test
  void omitsVariantWhenTheProviderSuppliesNone() throws Exception {
    flagReturns(true);

    mockMvc
        .perform(post("/api/ai-scan/start").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reason").value("STATIC"))
        // Jackson is configured to drop nulls, so the key is absent rather than
        // present-and-null - callers should treat missing as "no variant".
        .andExpect(jsonPath("$.variant").doesNotExist());
  }

  @Test
  void reportsUnavailableWhenTheFlagIsOffForTheSite() throws Exception {
    flagReturns(false);

    mockMvc
        .perform(post("/api/ai-scan/start").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(false))
        .andExpect(jsonPath("$.site").value("Toronto"))
        .andExpect(
            jsonPath("$.message")
                .value("Sorry this feature is not available at this site yet: Toronto"));
  }

  @Test
  void evaluatesTheFlagForTheSiteTheCallerSent() throws Exception {
    when(featureFlags.booleanDetails(
            eq("show-ai-scan"), eq(false), eq("lloyd.williams@datadoghq.com"), eq("Austin")))
        .thenReturn(
            FlagEvaluationDetails.<Boolean>builder().value(true).reason("TARGETING_MATCH").build());

    mockMvc
        .perform(
            post("/api/ai-scan/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"amount": 7, "email": "lloyd.williams@datadoghq.com", "site": "Austin"}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("AI Scan Successful at site: Austin"));
  }

  @Test
  void rejectsAmountOfAThousandOrMore() throws Exception {
    flagReturns(true);

    mockMvc
        .perform(
            post("/api/ai-scan/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"amount": 1000, "email": "jane@example.com", "site": "Toronto"}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("amount must be less than 1000"));
  }

  @Test
  void rejectsNegativeAmount() throws Exception {
    flagReturns(true);

    mockMvc
        .perform(
            post("/api/ai-scan/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"amount": -1, "email": "jane@example.com", "site": "Toronto"}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("amount must be 0 or greater"));
  }

  @Test
  void rejectsMissingSite() throws Exception {
    flagReturns(true);

    mockMvc
        .perform(
            post("/api/ai-scan/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"amount": 42, "email": "jane@example.com"}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("site is required"));
  }

  @Test
  void rejectsMalformedEmail() throws Exception {
    flagReturns(true);

    mockMvc
        .perform(
            post("/api/ai-scan/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"amount": 42, "email": "not-an-email", "site": "Toronto"}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("must be a valid email address"));
  }

  @Test
  void rejectsAnEmptyBody() throws Exception {
    mockMvc
        .perform(post("/api/ai-scan/start").contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Request body is missing or not valid JSON"));
  }
}
