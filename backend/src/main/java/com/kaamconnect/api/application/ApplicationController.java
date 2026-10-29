package com.kaamconnect.api.application;

import com.kaamconnect.api.job.Job;
import com.kaamconnect.api.job.JobRepository;
import com.kaamconnect.api.user.AppUser;
import com.kaamconnect.api.user.UserRepository;
import com.kaamconnect.api.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
@RequestMapping("/api/applications")
public class ApplicationController {
    private final ApplicationRepository applications;
    private final JobRepository jobs;
    private final UserRepository users;

    public ApplicationController(ApplicationRepository applications, JobRepository jobs, UserRepository users) {
        this.applications = applications;
        this.jobs = jobs;
        this.users = users;
    }

    @PostMapping
    @Transactional
    public ApplicationResponse apply(@Valid @RequestBody ApplyRequest request, @AuthenticationPrincipal Jwt token) {
        AppUser worker = currentUser(token);
        requireRole(worker, UserRole.WORKER);
        Job job = jobs.findById(request.jobId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
        if (job.isClosed()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This job is closed");
        if (job.getEmployer().getId().equals(worker.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot apply to your own job");
        }
        if (applications.existsByJobIdAndWorkerId(job.getId(), worker.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already applied to this job");
        }
        return ApplicationResponse.from(applications.save(new JobApplication(job, worker)));
    }

    @GetMapping("/mine")
    @Transactional(readOnly = true)
    public List<ApplicationResponse> mine(@AuthenticationPrincipal Jwt token) {
        AppUser worker = currentUser(token);
        requireRole(worker, UserRole.WORKER);
        return applications.findAllByWorkerIdOrderByCreatedAtDesc(worker.getId()).stream()
                .map(ApplicationResponse::from).toList();
    }

    @GetMapping("/for-employer")
    @Transactional(readOnly = true)
    public List<ApplicationResponse> forEmployer(@AuthenticationPrincipal Jwt token) {
        AppUser employer = currentUser(token);
        requireRole(employer, UserRole.EMPLOYER);
        return applications.findAllByJobEmployerIdOrderByCreatedAtDesc(employer.getId()).stream()
                .map(ApplicationResponse::from).toList();
    }

    @PatchMapping("/{id}")
    @Transactional
    public ApplicationResponse updateStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request,
                                            @AuthenticationPrincipal Jwt token) {
        AppUser employer = currentUser(token);
        requireRole(employer, UserRole.EMPLOYER);
        if (request.status() == ApplicationStatus.APPLIED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be ACCEPTED or REJECTED");
        }
        JobApplication application = applications.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        if (!application.getJob().getEmployer().getId().equals(employer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot update this application");
        }
        application.setStatus(request.status());
        return ApplicationResponse.from(applications.save(application));
    }

    private AppUser currentUser(Jwt token) {
        return users.findByPhone(token.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));
    }

    private void requireRole(AppUser user, UserRole role) {
        if (user.getRole() != role) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This action is not available for your account");
    }

    public record ApplyRequest(@NotNull UUID jobId) {}
    public record StatusRequest(@NotNull ApplicationStatus status) {}
}
