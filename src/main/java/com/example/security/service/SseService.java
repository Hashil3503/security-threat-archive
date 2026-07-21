package com.example.security.service;

import com.example.security.dto.ThreatLogDto;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /**
     * 클라이언트와 SSE 연결을 맺고 SseEmitter를 반환합니다.
     */
    public SseEmitter connect() {
        SseEmitter emitter = new SseEmitter(60 * 1000L); // 60초 타임아웃
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((e) -> emitters.remove(emitter));

        // 연결 확인용 초기 이벤트 전송 (브라우저 연결 유지를 위해 필수)
        try {
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data("Connected to Security Threat Archive Real-time Feed."));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    /**
     * 새로운 위협 로그 정보를 접속 중인 모든 클라이언트에게 실시간 전송합니다.
     */
    public void broadcast(ThreatLogDto logDto) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("THREAT_LOG")
                        .data(logDto));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }

    /**
     * 삭제된 위협 로그 정보를 접속 중인 모든 클라이언트에게 실시간 전송합니다.
     */
    public void broadcastDelete(ThreatLogDto logDto) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("THREAT_LOG_DELETE")
                        .data(logDto));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }

    /**
     * 데이터베이스 초기화(리셋) 이벤트를 모든 클라이언트에게 실시간 전송합니다.
     */
    public void broadcastReset() {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("THREAT_LOG_RESET")
                        .data("RESET"));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }
}
