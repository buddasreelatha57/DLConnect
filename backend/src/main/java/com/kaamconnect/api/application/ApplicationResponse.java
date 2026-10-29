package com.kaamconnect.api.application;

import java.util.UUID;

public record ApplicationResponse(
        UUID id, UUID jobId, String jobTitle, String workerName, ApplicationStatus status) {
    public static ApplicationResponse from(JobApplication application) {
        return new ApplicationResponse(application.getId(), application.getJob().getId(),
                application.getJob().getTitle(), application.getWorker().getName(), application.getStatus());
    }
}
