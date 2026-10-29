package com.kaamconnect.api.job;

import com.kaamconnect.api.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "jobs")
public class Job {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employer_id", nullable = false)
    private AppUser employer;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 80)
    private String category;

    @Column(name = "job_type", nullable = false, length = 24)
    private String type;

    @Column(nullable = false)
    private int pay;

    @Column(name = "workers_needed", nullable = false)
    private int workersNeeded;

    @Column(nullable = false, length = 180)
    private String place;

    private Double latitude;
    private Double longitude;

    @Column(nullable = false)
    private boolean closed;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Job() {}

    public Job(AppUser employer, String title, String category, String type, int pay,
               int workersNeeded, String place, Double latitude, Double longitude) {
        this.id = UUID.randomUUID();
        this.employer = employer;
        this.title = title;
        this.category = category;
        this.type = type;
        this.pay = pay;
        this.workersNeeded = workersNeeded;
        this.place = place;
        this.latitude = latitude;
        this.longitude = longitude;
        this.closed = false;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public AppUser getEmployer() { return employer; }
    public String getTitle() { return title; }
    public String getCategory() { return category; }
    public String getType() { return type; }
    public int getPay() { return pay; }
    public int getWorkersNeeded() { return workersNeeded; }
    public String getPlace() { return place; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public boolean isClosed() { return closed; }
    public Instant getCreatedAt() { return createdAt; }
    public void close() { this.closed = true; }
}
