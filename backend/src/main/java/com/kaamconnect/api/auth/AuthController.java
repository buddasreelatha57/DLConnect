package com.kaamconnect.api.auth;

import com.kaamconnect.api.user.AppUser;
import com.kaamconnect.api.user.UserRepository;
import com.kaamconnect.api.user.UserResponse;
import com.kaamconnect.api.user.UserRole;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;

    public AuthController(UserRepository users, PasswordEncoder passwords,
                          AuthenticationManager authenticationManager, JwtEncoder jwtEncoder) {
        this.users = users;
        this.passwords = passwords;
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        if (users.existsByPhone(request.phone())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This phone number is already registered");
        }
        if (request.role() == UserRole.EMPLOYER && (request.businessName() == null || request.businessName().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Business name is required for employer accounts");
        }
        if (request.role() == UserRole.WORKER && (request.skill() == null || request.skill().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A worker skill is required");
        }
        AppUser user = users.save(new AppUser(
                request.name().trim(), request.phone(), passwords.encode(request.password()), request.area().trim(),
                request.role(), request.role() == UserRole.WORKER ? request.skill() : null,
                request.role() == UserRole.EMPLOYER ? request.businessName().trim() : null));
        return response(user);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.phone(), request.password()));
        } catch (org.springframework.security.core.AuthenticationException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid phone number or password");
        }
        AppUser user = users.findByPhone(request.phone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid phone number or password"));
        return response(user);
    }

    private AuthResponse response(AppUser user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("kaam-connect")
                .issuedAt(now)
                .expiresAt(now.plus(12, ChronoUnit.HOURS))
                .subject(user.getPhone())
                .claim("role", user.getRole().name())
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new AuthResponse(token, UserResponse.from(user));
    }

    public record AuthResponse(String token, UserResponse user) {}

    public record RegisterRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Pattern(regexp = "[6-9][0-9]{9}") String phone,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 160) String area,
            @NotNull UserRole role,
            @Size(max = 80) String skill,
            @Size(max = 160) String businessName,
            @NotNull @AssertTrue Boolean adultConfirmed,
            @NotNull @AssertTrue Boolean rulesAgreed) {}

    public record LoginRequest(
            @NotBlank @Pattern(regexp = "[6-9][0-9]{9}") String phone,
            @NotBlank @Size(max = 72) String password) {}
}
