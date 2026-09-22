package com.example.samplejavaapi.userprofile;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class UserProfileControllerTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void returnsSeededProfile() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "jane@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value("jane@example.com"))
        .andExpect(jsonPath("$.firstName").value("Jane"))
        .andExpect(jsonPath("$.jobTitle").value("Platform Engineer"))
        .andExpect(jsonPath("$.memberSince").value("2023-07-01"))
        .andExpect(jsonPath("$.roles[0]").value("user"))
        .andExpect(jsonPath("$.account.id").value("acct-2002"))
        .andExpect(jsonPath("$.account.name").value("Example Corp"))
        .andExpect(jsonPath("$.account.plan").value("pro"));
  }

  @Test
  void seededUsersCanShareAnAccount() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "sam@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.account.id").value("acct-2002"));
  }

  @Test
  void lookupIsCaseInsensitiveAndTrimmed() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "  Jane@Example.COM "))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Jane Doe"));
  }

  @Test
  void derivesProfileForUnknownEmail() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "ada.lovelace@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.firstName").value("Ada"))
        .andExpect(jsonPath("$.lastName").value("Lovelace"))
        .andExpect(jsonPath("$.department").value("Demo"))
        .andExpect(jsonPath("$.account.id").value("acct-example-com"))
        .andExpect(jsonPath("$.account.name").value("Example"))
        .andExpect(jsonPath("$.account.plan").value("trial"));
  }

  @Test
  void rejectsMalformedEmail() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "not-an-email"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("must be a valid email address"));
  }

  @Test
  void rejectsMissingEmail() throws Exception {
    mockMvc
        .perform(get("/api/users/profile"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Missing required parameter 'email'"));
  }
}
