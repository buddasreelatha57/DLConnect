package com.kaamconnect.api.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByPhone(String phone);
    boolean existsByPhone(String phone);
}
