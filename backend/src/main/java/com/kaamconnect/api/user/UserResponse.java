package com.kaamconnect.api.user;

import java.util.UUID;

public record UserResponse(UUID id, String name, String phone, String area, UserRole role, String skill, String businessName) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(user.getId(), user.getName(), user.getPhone(), user.getArea(),
                user.getRole(), user.getSkill(), user.getBusinessName());
    }
}
