Prometheus exporter prototype for monitoring ip intercom

/probe request  
Return request specific metrics: intercom sip registration and uptime device via API

example
```shell
curl --location 'localhost:9191/probe?url=http%3A%2F%2F192.168.13.152&username=admin&password=demolanta&model=BEWARD%20DKS&alias=BEWARD%20DKS'
```

/metrics  
return all metrics