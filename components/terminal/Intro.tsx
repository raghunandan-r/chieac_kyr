export default function Intro() {

  return (
    <div className="intro-block" aria-hidden="false">
      <div className="help">
        <div className="col intro">
          <div className="intro-section">
            <p>
              <span className="desc">
              Welcome! Ask me questions about immigrant rights and services in the U.S. I will
              find answers from official non-profit guides.
            </span>
            </p>
            <p>
              <span className="cmd">Important:</span> 
              <span className="desc">
              I am an AI assistant, not a lawyer. This information is not
              legal advice. For legal advice, please speak with a qualified professional.
              </span>
            </p>

            <p>
              <span className="desc">
              ¡Bienvenido! Hazme preguntas sobre los derechos y servicios para inmigrantes en los EE.UU.
              Encontraré respuestas en las guías oficiales de organizaciones sin fines de lucro.
              </span>
            </p>
            <p>
              <span className="cmd">Importante:</span> 
              <span className="desc">
              Soy un asistente de IA, no un abogado. Esta información no es
              un consejo legal. Para recibir asesoramiento legal, por favor habla con un profesional
              calificado.</span>
            </p>
          </div>
                
        <div className="help-controls">
          <div className="col">
            <span className="cmd">Type to start</span>
            <span className="desc">Enter to send</span>
          </div>
       
          </div>
        </div>
      </div>
    </div>
  );
}


