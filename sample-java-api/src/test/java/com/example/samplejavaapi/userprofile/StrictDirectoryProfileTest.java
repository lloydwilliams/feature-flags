package com.example.samplejavaapi.userprofile;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** Unknown emails become 404s when strict directory mode is enabled. */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "sample.profile.strict-directory=true")
class StrictDirectoryProfileTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void returnsNotFoundForUnknownEmail() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "nobody@example.com"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.status").value(404));
  }

  @Test
  void stillReturnsSeededProfile() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "sam@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lastName").value("Rivera"));
  }
}
