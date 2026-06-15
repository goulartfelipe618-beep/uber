package health

import domainhealth "github.com/transportepro/geo-go/internal/domain/health"

type Service struct {
	serviceName string
}

func NewService(serviceName string) *Service {
	return &Service{serviceName: serviceName}
}

func (s *Service) Check() domainhealth.Status {
	return domainhealth.Status{
		Service: s.serviceName,
		Status:  "ok",
	}
}
