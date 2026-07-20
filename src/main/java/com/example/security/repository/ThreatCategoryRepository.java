package com.example.security.repository;

import com.example.security.entity.ThreatCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ThreatCategoryRepository extends JpaRepository<ThreatCategory, Long> {
    Optional<ThreatCategory> findByName(String name);
}
