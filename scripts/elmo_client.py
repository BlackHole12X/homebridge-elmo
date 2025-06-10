#!/usr/bin/env python3
import sys
import json
import logging
import time
from elmo.api.client import ElmoClient
from elmo.systems import ELMO_E_CONNECT, IESS_METRONET
import elmo.query as q

# Configurazione del logging
logging.basicConfig(
    level=logging.DEBUG if len(sys.argv) > 1 and sys.argv[1] == "--debug" else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("ElmoClient")

def get_base_url(system):
    if system == "e-connect":
        return ELMO_E_CONNECT
    elif system == "metronet":
        return IESS_METRONET
    else:
        raise ValueError(f"Sistema non supportato: {system}")

def authenticate(username, password, system, domain):
    try:
        base_url = get_base_url(system)
        client = ElmoClient(base_url=base_url, domain=domain)
        client.auth(username, password)
        return client, True, "Autenticazione riuscita"
    except Exception as e:
        logger.error(f"Errore di autenticazione: {e}")
        return None, False, str(e)

def get_status(client):
    try:
        # Ottieni lo stato dei settori
        sectors = client.query(q.SECTORS)
        # Ottieni lo stato degli ingressi
        inputs = client.query(q.INPUTS)
        # Ottieni lo stato degli avvisi
        alerts = client.query(q.ALERTS)
        
        return {
            "sectors": sectors,
            "inputs": inputs,
            "alerts": alerts
        }, True, "Stato ottenuto con successo"
    except Exception as e:
        logger.error(f"Errore nell'ottenere lo stato: {e}")
        return None, False, str(e)

def arm_system(client, code, sectors=None, max_retries=3):
    """
    Arma il sistema con retry logic
    """
    for attempt in range(max_retries):
        try:
            logger.debug(f"Tentativo di armamento {attempt + 1}/{max_retries}")
            
            # Verifica lo stato attuale prima di tentare l'armamento
            status, success, message = get_status(client)
            if not success:
                logger.warning(f"Impossibile verificare lo stato del sistema: {message}")
            
            # Attendi un momento prima di acquisire il lock
            time.sleep(1)
            
            with client.lock(code) as c:
                logger.debug("Lock acquisito con successo, procedendo con l'armamento")
                if sectors:
                    logger.debug(f"Armamento settori specifici: {sectors}")
                    c.arm(sectors=sectors)
                else:
                    logger.debug("Armamento di tutti i settori")
                    c.arm()
                logger.debug("Comando di armamento inviato")
                
            # Attendi un momento per permettere al sistema di processare il comando
            time.sleep(2)
            
            return True, "Sistema armato con successo"
            
        except Exception as e:
            logger.warning(f"Tentativo {attempt + 1} fallito: {e}")
            
            if attempt < max_retries - 1:
                # Attendi prima del prossimo tentativo
                wait_time = (attempt + 1) * 2
                logger.debug(f"Attendo {wait_time} secondi prima del prossimo tentativo")
                time.sleep(wait_time)
            else:
                logger.error(f"Tutti i tentativi di armamento falliti: {e}")
                return False, f"Errore nell'armare il sistema dopo {max_retries} tentativi: {str(e)}"

def disarm_system(client, code, sectors=None, max_retries=3):
    """
    Disarma il sistema con retry logic
    """
    for attempt in range(max_retries):
        try:
            logger.debug(f"Tentativo di disarmamento {attempt + 1}/{max_retries}")
            
            # Verifica lo stato attuale prima di tentare il disarmamento
            status, success, message = get_status(client)
            if not success:
                logger.warning(f"Impossibile verificare lo stato del sistema: {message}")
            
            # Attendi un momento prima di acquisire il lock
            time.sleep(1)
            
            with client.lock(code) as c:
                logger.debug("Lock acquisito con successo, procedendo con il disarmamento")
                if sectors:
                    logger.debug(f"Disarmamento settori specifici: {sectors}")
                    c.disarm(sectors=sectors)
                else:
                    logger.debug("Disarmamento di tutti i settori")
                    c.disarm()
                logger.debug("Comando di disarmamento inviato")
                
            # Attendi un momento per permettere al sistema di processare il comando
            time.sleep(2)
            
            return True, "Sistema disarmato con successo"
            
        except Exception as e:
            logger.warning(f"Tentativo {attempt + 1} fallito: {e}")
            
            if attempt < max_retries - 1:
                # Attendi prima del prossimo tentativo
                wait_time = (attempt + 1) * 2
                logger.debug(f"Attendo {wait_time} secondi prima del prossimo tentativo")
                time.sleep(wait_time)
            else:
                logger.error(f"Tutti i tentativi di disarmamento falliti: {e}")
                return False, f"Errore nel disarmare il sistema dopo {max_retries} tentativi: {str(e)}"

def check_system_ready(client):
    """
    Verifica se il sistema è pronto per ricevere comandi
    """
    try:
        logger.debug("Verifica dello stato del sistema")
        status, success, message = get_status(client)
        
        if not success:
            return False, f"Impossibile verificare lo stato: {message}"
        
        # Verifica se ci sono allarmi attivi che potrebbero impedire l'operazione
        if status.get("alerts") and len(status["alerts"]) > 0:
            active_alerts = [alert for alert in status["alerts"] if alert.get("active", False)]
            if active_alerts:
                logger.warning(f"Trovati {len(active_alerts)} allarmi attivi")
                return False, f"Sistema non pronto: {len(active_alerts)} allarmi attivi"
        
        return True, "Sistema pronto"
        
    except Exception as e:
        logger.error(f"Errore nella verifica dello stato del sistema: {e}")
        return False, str(e)

def main():
    if len(sys.argv) < 2:
        print("Uso: python elmo_client.py <comando> [argomenti...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "authenticate":
        if len(sys.argv) < 6:
            print("Uso: python elmo_client.py authenticate <username> <password> <system> <domain>")
            sys.exit(1)
        
        username = sys.argv[2]
        password = sys.argv[3]
        system = sys.argv[4]
        domain = sys.argv[5]
        
        _, success, message = authenticate(username, password, system, domain)
        result = {"success": success, "message": message}
        print(json.dumps(result))
    
    elif command == "status":
        if len(sys.argv) < 6:
            print("Uso: python elmo_client.py status <username> <password> <system> <domain>")
            sys.exit(1)
        
        username = sys.argv[2]
        password = sys.argv[3]
        system = sys.argv[4]
        domain = sys.argv[5]
        
        client, success, message = authenticate(username, password, system, domain)
        if not success:
            result = {"success": False, "message": message}
            print(json.dumps(result))
            sys.exit(1)
        
        status, success, message = get_status(client)
        result = {"success": success, "message": message, "status": status}
        print(json.dumps(result))
    
    elif command == "arm":
        if len(sys.argv) < 7:
            print("Uso: python elmo_client.py arm <username> <password> <system> <domain> <code> [sectors]")
            sys.exit(1)
        
        username = sys.argv[2]
        password = sys.argv[3]
        system = sys.argv[4]
        domain = sys.argv[5]
        code = sys.argv[6]
        sectors = None
        if len(sys.argv) > 7:
            sectors = [int(s) for s in sys.argv[7].split(",")]
        
        client, success, message = authenticate(username, password, system, domain)
        if not success:
            result = {"success": False, "message": message}
            print(json.dumps(result))
            sys.exit(1)
        
        success, message = arm_system(client, code, sectors)
        result = {"success": success, "message": message}
        print(json.dumps(result))
    
    elif command == "disarm":
        if len(sys.argv) < 7:
            print("Uso: python elmo_client.py disarm <username> <password> <system> <domain> <code> [sectors]")
            sys.exit(1)
        
        username = sys.argv[2]
        password = sys.argv[3]
        system = sys.argv[4]
        domain = sys.argv[5]
        code = sys.argv[6]
        sectors = None
        if len(sys.argv) > 7:
            sectors = [int(s) for s in sys.argv[7].split(",")]
        
        client, success, message = authenticate(username, password, system, domain)
        if not success:
            result = {"success": False, "message": message}
            print(json.dumps(result))
            sys.exit(1)
        
        success, message = disarm_system(client, code, sectors)
        result = {"success": success, "message": message}
        print(json.dumps(result))
    
    else:
        print(f"Comando non riconosciuto: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
