import { useMemo, useState, type FormEvent } from 'react'
import './App.css'

type Campaign = {
  id: string
  organization: string
  title: string
  summary: string
  goal: number
  raised: number
  category: string
  accent: string
}

type SimulatedDonation = {
  id: string
  campaignId: string
  amountInCents: number
  donorName?: string
  isPublic: boolean
  status: 'SIMULATED_SUCCESS'
}

const initialCampaigns: Campaign[] = [
  {
    id: 'community-library',
    organization: 'Asociación Semillas del Sur',
    title: 'Un espacio para aprender juntos',
    summary:
      'Acondicionamiento de una biblioteca comunitaria y materiales de lectura para niñas y niños.',
    goal: 18000,
    raised: 12450,
    category: 'Educación',
    accent: 'amber',
  },
  {
    id: 'clean-water',
    organization: 'Fundación Agua para Todos',
    title: 'Agua segura, comunidad fuerte',
    summary:
      'Mejora de sistemas de almacenamiento de agua y talleres de cuidado comunitario.',
    goal: 24000,
    raised: 16800,
    category: 'Bienestar',
    accent: 'blue',
  },
  {
    id: 'community-garden',
    organization: 'Asociación Huertos de Barrio',
    title: 'Cultivando un futuro compartido',
    summary:
      'Herramientas y capacitación para mantener huertos comunitarios durante todo el año.',
    goal: 12000,
    raised: 7140,
    category: 'Comunidad',
    accent: 'green',
  },
]

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 2,
})

function App() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [amount, setAmount] = useState('50')
  const [donorName, setDonorName] = useState('')
  const [showPublicly, setShowPublicly] = useState(false)
  const [donations, setDonations] = useState<SimulatedDonation[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const campaigns = useMemo(
    () =>
      initialCampaigns.map((campaign) => ({
        ...campaign,
        raised:
          campaign.raised +
          donations
            .filter(
              (donation) =>
                donation.campaignId === campaign.id &&
                donation.status === 'SIMULATED_SUCCESS',
            )
            .reduce(
              (total, donation) => total + donation.amountInCents / 100,
              0,
            ),
      })),
    [donations],
  )

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedCampaignId,
  )

  function openDonation(campaignId: string) {
    setSelectedCampaignId(campaignId)
    setNotice(null)
    setShowPublicly(false)
    setDonorName('')
    setAmount('50')
  }

  function closeDonation() {
    setSelectedCampaignId(null)
    setNotice(null)
  }

  function submitDonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = Number(amount)
    if (
      !selectedCampaign ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount < 1 ||
      parsedAmount > 5000
    ) {
      setNotice('Ingresa un monto válido entre S/ 1 y S/ 5,000.')
      return
    }

    if (showPublicly && donorName.trim().length === 0) {
      setNotice('Ingresa el nombre que autorizas mostrar públicamente.')
      return
    }

    const donation: SimulatedDonation = {
      id: crypto.randomUUID(),
      campaignId: selectedCampaign.id,
      amountInCents: Math.round(parsedAmount * 100),
      donorName: showPublicly ? donorName.trim() : undefined,
      isPublic: showPublicly,
      status: 'SIMULATED_SUCCESS',
    }

    setDonations((current) => [donation, ...current])
    setNotice(
      'Donación simulada correctamente. No se realizó ningún cobro ni se recibió dinero.',
    )
  }

  return (
    <div className="app-shell">
      <div className="simulation-banner" role="status">
        <span className="simulation-dot" aria-hidden="true" />
        <span>
          DEMOSTRACIÓN LOCAL · Backend AWS pendiente · Sin pasarela ni cobros
        </span>
      </div>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Manos, inicio">
          <span className="brand-mark" aria-hidden="true">
            m.
          </span>
          <span>manos</span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a className="nav-active" href="#campanas">
            Campañas
          </a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#seguridad">Seguridad</a>
        </nav>
        <a className="header-link" href="#seguridad">
          Un proyecto con propósito <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="inicio">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              Pequeñas acciones, grandes cambios
            </p>
            <h1 id="hero-title">
              El futuro se
              <br />
              construye <em>en comunidad.</em>
            </h1>
            <p className="hero-description">
              Conoce proyectos sociales que transforman comunidades y acompaña
              las ideas que hacen la diferencia.
            </p>
            <a className="primary-link" href="#campanas">
              Explorar proyectos <span aria-hidden="true">↓</span>
            </a>
            <div className="hero-footnote">
              <span className="avatar-stack" aria-hidden="true">
                <span>J</span>
                <span>M</span>
                <span>A</span>
              </span>
              <span>Iniciativas creadas desde la comunidad</span>
            </div>
          </div>
          <div className="hero-art" aria-label="Ilustración de una comunidad unida">
            <div className="art-sun" />
            <div className="art-plant art-plant-left">
              <i />
              <i />
              <i />
            </div>
            <div className="art-plant art-plant-right">
              <i />
              <i />
              <i />
            </div>
            <div className="art-hill art-hill-back" />
            <div className="art-hill art-hill-front" />
            <div className="people-group" aria-hidden="true">
              <span className="person person-one">
                <i />
                <b />
              </span>
              <span className="person person-two">
                <i />
                <b />
              </span>
              <span className="person person-three">
                <i />
                <b />
              </span>
              <span className="person person-four">
                <i />
                <b />
              </span>
            </div>
            <span className="art-label">Juntos llegamos más lejos</span>
          </div>
        </section>

        <section className="impact-strip" aria-label="Impacto de las iniciativas">
          <div>
            <strong>03</strong>
            <span>proyectos destacados</span>
          </div>
          <span className="impact-divider" />
          <div>
            <strong>100%</strong>
            <span>compromiso comunitario</span>
          </div>
          <p>Un espacio para conectar buenas ideas con personas que quieren ayudar.</p>
        </section>

        <section className="campaign-section" id="campanas">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" />
                Elige cómo sumar
              </p>
              <h2>Proyectos que nos <em>mueven.</em></h2>
            </div>
            <p className="section-intro">
              Cada iniciativa nace de una necesidad real y crece con el apoyo de
              su comunidad.
            </p>
          </div>

          <div className="campaign-grid">
            {campaigns.map((campaign, index) => {
              const progress = Math.min(
                Math.round((campaign.raised / campaign.goal) * 100),
                100,
              )
              return (
                <article className="campaign-card" key={campaign.id}>
                  <div className={`campaign-art campaign-art-${campaign.accent}`}>
                    <span className="campaign-number">0{index + 1}</span>
                    <span className="category-tag">{campaign.category}</span>
                    <div className="card-illustration" aria-hidden="true">
                      <span className="illustration-sun" />
                      <span className="illustration-shape shape-one" />
                      <span className="illustration-shape shape-two" />
                      <span className="illustration-shape shape-three" />
                      <span className="illustration-ground" />
                    </div>
                  </div>
                  <div className="campaign-content">
                    <p className="organization">{campaign.organization}</p>
                    <h3>{campaign.title}</h3>
                    <p className="campaign-summary">{campaign.summary}</p>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={`Avance simulado de ${campaign.title}`}
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <div className="campaign-totals">
                      <span>
                        <strong>{currency.format(campaign.raised)}</strong>
                        <small>simulado</small>
                      </span>
                      <span className="goal-amount">
                        Meta {currency.format(campaign.goal)}
                      </span>
                    </div>
                    {donations
                      .filter(
                        (donation) =>
                          donation.campaignId === campaign.id &&
                          donation.isPublic &&
                          donation.status === 'SIMULATED_SUCCESS',
                      )
                      .slice(0, 2)
                      .map((donation) => (
                        <div className="public-supporter" key={donation.id}>
                          <span>{donation.donorName}</span>
                          <span>
                            {currency.format(donation.amountInCents / 100)}
                          </span>
                        </div>
                      ))}
                    <button
                      className="donate-button"
                      type="button"
                      onClick={() => openDonation(campaign.id)}
                    >
                      Apoyar este proyecto <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="values-section" id="como-funciona">
          <div className="values-heading">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              Así sumamos
            </p>
            <h2>Apoyar también es <em>confiar.</em></h2>
          </div>
          <div className="value-list">
            <article>
              <span className="value-number">01</span>
              <div>
                <h3>Proyectos con propósito</h3>
                <p>Iniciativas comunitarias con objetivos claros y visibles.</p>
              </div>
              <span className="value-arrow" aria-hidden="true">↗</span>
            </article>
            <article id="seguridad">
              <span className="value-number">02</span>
              <div>
                <h3>Seguridad desde el inicio</h3>
                <p>
                  Cada acción se valida. Esta versión académica simula el flujo
                  y no procesa donaciones reales.
                </p>
              </div>
              <span className="value-arrow" aria-hidden="true">↗</span>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#inicio">
          <span className="brand-mark" aria-hidden="true">m.</span>
          <span>manos</span>
        </a>
        <span>Un proyecto académico para imaginar un futuro mejor.</span>
        <span className="footer-status">
          <span className="simulation-dot" aria-hidden="true" />
          Modo de prueba
        </span>
      </footer>

      {selectedCampaign && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDonation()
          }}
        >
          <section
            aria-labelledby="donation-title"
            aria-modal="true"
            className="donation-modal"
            role="dialog"
          >
            <button
              className="modal-close"
              onClick={closeDonation}
              type="button"
              aria-label="Cerrar formulario"
            >
              ×
            </button>
            <p className="eyebrow">
              <span className="eyebrow-line" />
              Donación de prueba
            </p>
            <h2 id="donation-title">Suma a esta iniciativa.</h2>
            <p className="modal-campaign">{selectedCampaign.title}</p>
            <form onSubmit={submitDonation}>
              <label htmlFor="donation-amount">Monto simulado (PEN)</label>
              <div className="amount-field">
                <span>S/</span>
                <input
                  autoFocus
                  id="donation-amount"
                  inputMode="decimal"
                  min="1"
                  max="5000"
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={amount}
                />
              </div>
              <div className="quick-amounts" aria-label="Montos sugeridos">
                {[20, 50, 100, 200].map((suggestion) => (
                  <button
                    className={Number(amount) === suggestion ? 'chosen' : ''}
                    key={suggestion}
                    onClick={() => setAmount(String(suggestion))}
                    type="button"
                  >
                    S/ {suggestion}
                  </button>
                ))}
              </div>
              <label className="consent-option">
                <input
                  checked={showPublicly}
                  onChange={(event) => setShowPublicly(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Autorizo mostrar públicamente mi nombre y el monto de esta
                  donación simulada.
                </span>
              </label>
              {showPublicly && (
                <label htmlFor="donor-name">
                  Nombre para mostrar
                  <input
                    autoComplete="name"
                    id="donor-name"
                    maxLength={80}
                    onChange={(event) => setDonorName(event.target.value)}
                    required
                    type="text"
                    value={donorName}
                  />
                </label>
              )}
              <p className="demo-disclaimer">
                Esta es una simulación académica. No se realizará un cargo ni se
                recibirán fondos.
              </p>
              {notice && (
                <p aria-live="polite" className="form-notice" role="status">
                  {notice}
                </p>
              )}
              {notice?.startsWith('Donación simulada') ? (
                <button className="donate-button modal-submit" onClick={closeDonation} type="button">
                  Listo
                </button>
              ) : (
                <button className="donate-button modal-submit" type="submit">
                  Simular donación <span aria-hidden="true">↗</span>
                </button>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
