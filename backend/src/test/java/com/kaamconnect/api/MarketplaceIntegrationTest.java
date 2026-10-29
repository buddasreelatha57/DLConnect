package com.kaamconnect.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MarketplaceIntegrationTest {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @Test
    void employerPostsAndAcceptsWorkerApplication() throws Exception {
        String employerToken = register("9876543210", "EMPLOYER", "Bright Homes");
        String workerToken = register("9876543211", "WORKER", null);

        MvcResult posted = mvc.perform(post("/api/jobs")
                        .header("Authorization", "Bearer " + employerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Electrician needed",
                                  "category": "Electrical",
                                  "type": "Daily",
                                  "pay": 1200,
                                  "workersNeeded": 2,
                                  "place": "Indiranagar",
                                  "latitude": 12.9716,
                                  "longitude": 77.5946
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employerName").value("Bright Homes"))
                .andExpect(jsonPath("$.latitude").value(12.9716))
                .andReturn();
        String jobId = mapper.readTree(posted.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(get("/api/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(jobId))
                .andExpect(jsonPath("$[0].employerName").value("Bright Homes"));
        mvc.perform(get("/api/jobs/mine").header("Authorization", "Bearer " + employerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(jobId));

        MvcResult applied = mvc.perform(post("/api/applications")
                        .header("Authorization", "Bearer " + workerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobId\":\"" + jobId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andReturn();
        String applicationId = mapper.readTree(applied.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(post("/api/applications")
                        .header("Authorization", "Bearer " + workerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobId\":\"" + jobId + "\"}"))
                .andExpect(status().isConflict());

        mvc.perform(patch("/api/applications/" + applicationId)
                        .header("Authorization", "Bearer " + employerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        mvc.perform(get("/api/applications/mine").header("Authorization", "Bearer " + workerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].jobTitle").value("Electrician needed"))
                .andExpect(jsonPath("$[0].status").value("ACCEPTED"));
        mvc.perform(get("/api/applications/for-employer").header("Authorization", "Bearer " + employerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].workerName").value("Test 9876543211"));
        assertThat(jobId).isNotBlank();
    }

    @Test
    void workerCannotPostAnEmployerJob() throws Exception {
        String workerToken = register("9876543212", "WORKER", null);
        mvc.perform(post("/api/jobs")
                        .header("Authorization", "Bearer " + workerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Test","category":"Other","type":"Daily","pay":100,
                                 "workersNeeded":1,"place":"Bengaluru"}
                                """))
                .andExpect(status().isForbidden());
    }

    private String register(String phone, String role, String businessName) throws Exception {
        String body = """
                {
                  "name": "Test %s",
                  "phone": "%s",
                  "password": "secure-test-password",
                  "area": "Bengaluru",
                  "role": "%s",
                  "skill": "Electrical",
                  "businessName": %s,
                  "adultConfirmed": true,
                  "rulesAgreed": true
                }
                """.formatted(phone, phone, role, businessName == null ? "null" : "\""+ businessName + "\"");
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode response = mapper.readTree(result.getResponse().getContentAsString());
        assertThat(response.path("user").path("phone").asText()).isEqualTo(phone);
        return response.path("token").asText();
    }
}
