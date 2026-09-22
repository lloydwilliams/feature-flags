package com.example.samplejavaapi.flags;

import datadog.trace.api.openfeature.Provider;
import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.OpenFeatureAPI;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers Datadog's OpenFeature provider for server-side feature flags.
 *
 * <p>The provider is evaluated inside dd-java-agent, so flags only resolve for real when the app
 * runs under {@code -javaagent:./dd-java-agent.jar} with a Datadog API key available. Registration
 * failing is therefore expected in tests and in a plain {@code java -jar} run: OpenFeature keeps
 * its no-op provider, every evaluation returns the default passed at the call site, and the app
 * starts either way.
 */
@Configuration
public class FeatureFlagsConfig {

  private static final Logger log = LoggerFactory.getLogger(FeatureFlagsConfig.class);

  /** Name this client reports to Datadog; keeps its evaluations distinguishable per service. */
  private static final String CLIENT_NAME = "sample-java-api";

  private final long initTimeoutSeconds;

  public FeatureFlagsConfig(
      @Value("${sample.flags.init-timeout-seconds:5}") long initTimeoutSeconds) {
    this.initTimeoutSeconds = initTimeoutSeconds;
  }

  @Bean
  public Client openFeatureClient() {
    OpenFeatureAPI api = OpenFeatureAPI.getInstance();

    try {
      // setProviderAndWait blocks until the first flag configuration arrives, so the
      // first request cannot race initialization and silently read defaults. Bounded,
      // so an unreachable Datadog delays startup by seconds rather than hanging it.
      api.setProviderAndWait(
          new Provider(new Provider.Options().initTimeout(initTimeoutSeconds, TimeUnit.SECONDS)));
      log.info("Datadog feature flag provider registered for client={}", CLIENT_NAME);
    } catch (Exception e) {
      // Deliberately not fatal - see the class comment.
      log.warn(
          "Datadog feature flag provider unavailable ({}: {}); flags will return their code "
              + "defaults. Expected without dd-java-agent or DD_API_KEY.",
          e.getClass().getSimpleName(),
          e.getMessage());
    }

    return api.getClient(CLIENT_NAME);
  }
}
