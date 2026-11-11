from locust import HttpUser, task, between

class UsuarioSaaS(HttpUser):
    # Simula o tempo que um usuário real passa lendo a tela antes de clicar em algo (1 a 5 segundos)
    wait_time = between(1, 5)

    def on_start(self):
        """
        Executado uma única vez assim que o usuário virtual é criado.
        É o local perfeito para autenticação.
        """
        # Dispara o POST para sua rota de login (ajuste a URL e o payload)
        resposta = self.client.post("/api/login", json={
            "email": "usuario_teste@seusaas.com",
            "password": "senha_de_teste"
        })
        
        # Se sua aplicação usa JWT em vez de cookies, capture o token da resposta:
        # self.token = resposta.json().get("token")

    @task(3)
    def acessar_dashboard(self):
        """
        O @task define uma ação que o usuário repetirá.
        O peso 3 significa que esta ação tem 3x mais chance de ser escolhida do que a tarefa de perfil.
        """
        # Se usar JWT, adicione o cabeçalho: headers={"Authorization": f"Bearer {self.token}"}
        self.client.get("/api/dashboard")

    @task(1)
    def acessar_perfil(self):
        """Ação menos frequente (peso 1)."""
        self.client.get("/api/perfil")