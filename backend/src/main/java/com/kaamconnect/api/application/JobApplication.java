package com.kaamconnect.api.application;

import com.kaamconnect.api.job.Job;
import com.kaamconnect.api.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "applications", uniqueConstraints = @UniqueConstraint(
        name = "applications_job_worker_unique", columnNames = {"job_id", "worker_id"}))
public class JobApplication {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private AppUser worker;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ApplicationStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected JobApplication() {}

    public JobApplication(Job job, AppUser worker) {
        this.id = UUID.randomUUID();
        this.job = job;
        this.worker = worker;
        this.status = ApplicationStatus.APPLIED;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Job getJob() { return job; }
    public AppUser getWorker() { return worker; }
    public ApplicationStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setStatus(ApplicationStatus status) { this.status = status; }
}
