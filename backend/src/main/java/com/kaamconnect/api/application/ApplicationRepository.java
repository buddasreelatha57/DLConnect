package com.kaamconnect.api.application;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationRepository extends JpaRepository<JobApplication, UUID> {
    List<JobApplication> findAllByWorkerIdOrderByCreatedAtDesc(UUID workerId);
    List<JobApplication> findAllByJobEmployerIdOrderByCreatedAtDesc(UUID employerId);
    boolean existsByJobIdAndWorkerId(UUID jobId, UUID workerId);
}
