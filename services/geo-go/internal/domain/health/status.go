package health

type Status struct {
	Service string `json:"service"`
	Status  string `json:"status"`
}
