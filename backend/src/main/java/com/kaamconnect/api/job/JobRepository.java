package com.kaamconnect.api.job;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobRepository extends JpaRepository<Job, UUID> {
    List<Job> findAllByClosedFalseOrderByCreatedAtDesc();
    List<Job> findAllByEmployerIdOrderByCreatedAtDesc(UUID employerId);
    Optional<Job> findByIdAndEmployerId(UUID id, UUID employerId);
}
