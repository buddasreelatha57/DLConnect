package com.kaamconnect.api.job;

import com.kaamconnect.api.user.AppUser;
import com.kaamconnect.api.user.UserRepository;
import com.kaamconnect.api.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/jobs")
public class JobController {
    private final JobRepository jobs;
    private final UserRepository users;

    public JobController(JobRepository jobs, UserRepository users) {
        this.jobs = jobs;
        this.users = users;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<JobResponse> availableJobs() {
        return jobs.findAllByClosedFalseOrderByCreatedAtDesc().stream().map(JobResponse::from).toList();
    }

    @GetMapping("/mine")
    @Transactional(readOnly = true)
    public List<JobResponse> myJobs(@AuthenticationPrincipal Jwt token) {
        AppUser employer = currentEmployer(token);
        return jobs.findAllByEmployerIdOrderByCreatedAtDesc(employer.getId()).stream().map(JobResponse::from).toList();
    }

    @PostMapping
    @Transactional
    public JobResponse create(@Valid @RequestBody JobRequest request, @AuthenticationPrincipal Jwt token) {
        AppUser employer = currentEmployer(token);
        if ((request.latitude() == null) != (request.longitude() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide both map coordinates or neither");
        }
        Job job = jobs.save(new Job(employer, request.title().trim(), request.category().trim(),
                request.type(), request.pay(), request.workersNeeded(), request.place().trim(),
                request.latitude(), request.longitude()));
        return JobResponse.from(job);
    }

    @PatchMapping("/{id}/close")
    @Transactional
    public JobResponse close(@PathVariable UUID id, @AuthenticationPrincipal Jwt token) {
        AppUser employer = currentEmployer(token);
        Job job = jobs.findByIdAndEmployerId(id, employer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
        job.close();
        return JobResponse.from(jobs.save(job));
    }

    private AppUser currentEmployer(Jwt token) {
        AppUser user = users.findByPhone(token.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));
        if (user.getRole() != UserRole.EMPLOYER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only employers can manage jobs");
        }
        return user;
    }

    public record JobRequest(
            @NotBlank @Size(max = 100) String title,
            @NotBlank @Size(max = 80) String category,
            @NotBlank @Size(max = 24) String type,
            @Min(1) @Max(1_000_000) int pay,
            @Min(1) @Max(1_000) int workersNeeded,
            @NotBlank @Size(max = 180) String place,
            @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude) {}
}
