package com.example.security.repository;

import com.example.security.entity.ThreatLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ThreatLogRepository extends JpaRepository<ThreatLog, Long> {
    
    @Query("SELECT l FROM ThreatLog l JOIN FETCH l.threatCategory")
    List<ThreatLog> findAllWithCategory();
}
