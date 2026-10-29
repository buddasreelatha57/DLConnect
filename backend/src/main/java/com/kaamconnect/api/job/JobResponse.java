package com.kaamconnect.api.job;

import java.util.UUID;

public record JobResponse(
        UUID id, String title, String category, String type, int pay, int workersNeeded,
        String place, Double latitude, Double longitude, String employerName, boolean closed) {
    public static JobResponse from(Job job) {
        String employerName = job.getEmployer().getBusinessName() == null
                ? job.getEmployer().getName() : job.getEmployer().getBusinessName();
        return new JobResponse(job.getId(), job.getTitle(), job.getCategory(), job.getType(),
                job.getPay(), job.getWorkersNeeded(), job.getPlace(), job.getLatitude(),
                job.getLongitude(), employerName, job.isClosed());
    }
}
