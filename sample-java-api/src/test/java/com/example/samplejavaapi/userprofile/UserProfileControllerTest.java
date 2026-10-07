package com.example.samplejavaapi.userprofile;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

import java.util.List;

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
        .andExpect(jsonPath("$.id").value("28ea71b5-164b-4eb6-aef4-f4f793d4f086"))
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
  void seededDirectoryUsersAllCarryAUuid() throws Exception {
    // Spot-checks the bulk entries added via the compact `seeded` helper, which
    // is where a typo in a generated id or email would otherwise go unnoticed.
    String uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    for (String email :
        List.of(
            "amara.okonkwo@northwind.example",
            "devin.park@contoso.example",
            "ethan.whitfield@umbrella.example")) {
      mockMvc
          .perform(get("/api/users/profile").param("email", email))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.id").value(matchesPattern(uuid)))
          .andExpect(jsonPath("$.email").value(email));
    }
  }

  @Test
  void idsUseUuidFormat() throws Exception {
    String uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    mockMvc
        .perform(get("/api/users/profile").param("email", "sam@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(matchesPattern(uuid)));
    mockMvc
        .perform(get("/api/users/profile").param("email", "ada.lovelace@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(matchesPattern(uuid)));
  }

  @Test
  void derivedIdIsStableAcrossRequests() throws Exception {
    // A changing id would give the same person a new identity on every sign-in.
    String first =
        mockMvc
            .perform(get("/api/users/profile").param("email", "grace.hopper@example.com"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String second =
        mockMvc
            .perform(get("/api/users/profile").param("email", "  Grace.Hopper@Example.com "))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(JsonPath.<String>read(first, "$.id"))
        .isEqualTo(JsonPath.read(second, "$.id"));
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
  void emailStartingWithErrorFailsWithServerError() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "error@example.com"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.status").value(500))
        .andExpect(jsonPath("$.message").value("Profile lookup failed for error@example.com"));
  }

  @Test
  void emailStartingWithWarnIsRejected() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "warning.test@example.com"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.status").value(422))
        .andExpect(
            jsonPath("$.message").value("Profile lookup rejected for warning.test@example.com"));
  }

  @Test
  void demoPrefixesAreCaseInsensitive() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "ERROR@example.com"))
        .andExpect(status().isInternalServerError());
    mockMvc
        .perform(get("/api/users/profile").param("email", "Warn@example.com"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void anEmailMerelyContainingErrorStillSucceeds() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "terror.fan@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.firstName").value("Terror"));
  }

  @Test
  void acceptsSiteForFlagTargeting() throws Exception {
    mockMvc
        .perform(
            get("/api/users/profile").param("email", "jane@example.com").param("site", "Toronto"))
        .andExpect(status().isOk())
        // site is flag-targeting context only: the profile is unchanged by it,
        // and in particular does not become the profile's own location.
        .andExpect(jsonPath("$.displayName").value("Jane Doe"))
        .andExpect(jsonPath("$.location").value("Sydney, AU"));
  }

  @Test
  void siteRemainsOptional() throws Exception {
    mockMvc
        .perform(get("/api/users/profile").param("email", "jane@example.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Jane Doe"));
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
