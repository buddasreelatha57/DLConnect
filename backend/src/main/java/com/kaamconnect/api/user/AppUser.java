package com.kaamconnect.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class AppUser {
    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 10)
    private String phone;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false, length = 160)
    private String area;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;

    @Column(length = 80)
    private String skill;

    @Column(name = "business_name", length = 160)
    private String businessName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AppUser() {}

    public AppUser(String name, String phone, String passwordHash, String area, UserRole role, String skill, String businessName) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.phone = phone;
        this.passwordHash = passwordHash;
        this.area = area;
        this.role = role;
        this.skill = skill;
        this.businessName = businessName;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getPasswordHash() { return passwordHash; }
    public String getArea() { return area; }
    public UserRole getRole() { return role; }
    public String getSkill() { return skill; }
    public String getBusinessName() { return businessName; }
}
