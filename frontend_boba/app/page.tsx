"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { FallingBobaBackground } from "@/components/falling-boba-background"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type SearchResult = {
  business_id: string
  name: string | null
  city: string | null
  state: string | null
  avg_sentiment_polarity: number
  matching_review_count: number
}

function HomeContent() {
  const PAGE_SIZE = 15
  const searchParams = useSearchParams()
  const [phrase, setPhrase] = React.useState("")
  const [cityFilter, setCityFilter] = React.useState("")
  const [countyFilter, setCountyFilter] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [currentPage, setCurrentPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalResults, setTotalResults] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Query we last finished a search for; avoids "no results" while only typing. */
  const [lastSearchedPhrase, setLastSearchedPhrase] = React.useState<
    string | null
  >(null)
  const initializedFromUrlRef = React.useRef(false)

  async function fetchSearch(
    targetPage: number,
    overrides?: { phrase?: string; city?: string; county?: string }
  ) {
    const effectivePhrase = overrides?.phrase ?? phrase
    const effectiveCity = overrides?.city ?? cityFilter
    const effectiveCounty = overrides?.county ?? countyFilter

    const trimmedPhrase = effectivePhrase.trim()
    if (!trimmedPhrase) return

    setLoading(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
      const params = new URLSearchParams({
        q: trimmedPhrase,
        min_reviews: "3",
        page: String(targetPage),
        page_size: String(PAGE_SIZE),
      })
      if (effectiveCity.trim()) params.set("city", effectiveCity.trim())
      if (effectiveCounty.trim()) params.set("county", effectiveCounty.trim())
      const response = await fetch(
        `${apiBase}/api/search?${params.toString()}`,
        { method: "GET" }
      )
      if (!response.ok) {
        throw new Error("Search request failed")
      }
      const payload = await response.json()
      setResults(payload.results ?? [])
      setCurrentPage(payload.page ?? targetPage)
      setTotalPages(payload.total_pages ?? 1)
      setTotalResults(payload.total_results ?? 0)
      setLastSearchedPhrase(trimmedPhrase)
    } catch (err) {
      console.error(err)
      setError("Unable to search right now. Check backend connection.")
      setResults([])
      setCurrentPage(1)
      setTotalPages(1)
      setTotalResults(0)
      setLastSearchedPhrase(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await fetchSearch(1)
  }

  React.useEffect(() => {
    if (initializedFromUrlRef.current) return
    const q = (searchParams.get("q") ?? "").trim()
    if (!q) {
      initializedFromUrlRef.current = true
      return
    }
    const city = (searchParams.get("city") ?? "").trim()
    const county = (searchParams.get("county") ?? "").trim()
    const pageFromUrl = Number(searchParams.get("page") ?? "1")

    setPhrase(q)
    setCityFilter(city)
    setCountyFilter(county)

    initializedFromUrlRef.current = true
    const targetPage = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1
    void fetchSearch(targetPage, { phrase: q, city, county })
  }, [searchParams])

  function pageNumbers(total: number, current: number): number[] {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 3) return [1, 2, 3, 4, 5]
    if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
    return [current - 2, current - 1, current, current + 1, current + 2]
  }

  return (
    <section
      id="home"
      className="relative min-h-screen grid place-items-center overflow-hidden py-10 sm:py-14"
    >
      <FallingBobaBackground />
      <div className="relative z-10 w-full max-w-2xl space-y-4 text-center px-4 pb-10 sm:pb-14">
        <h1 className="text-5xl font-semibold pb-10">Find Your Next Boba Stop!</h1>
        <form onSubmit={handleSearch}>
          <InputGroup>
            <InputGroupInput
              placeholder="Enter a type of drink..."
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="secondary">
                {loading ? "Searching..." : "Search"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InputGroup>
              <InputGroupInput
                placeholder="City (Santa Barabara, etc.) (optional)"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
              />
            </InputGroup>
            <InputGroup>
              <InputGroupInput
                placeholder="State (CA, NY, etc.) (optional)"
                value={countyFilter}
                onChange={(event) => setCountyFilter(event.target.value)}
              />
            </InputGroup>
          </div>
        </form>

        {error ? <p className="text-red-600">{error}</p> : null}

        <div className="text-left space-y-3 pt-4">
          {results.map((item, index) => (
            <div key={item.business_id} className="rounded border p-3">
              <Link
                className="block hover:opacity-90"
                href={{
                  pathname: `/restaurant/${item.business_id}`,
                  query: {
                    q: phrase.trim(),
                    city: cityFilter.trim(),
                    county: countyFilter.trim(),
                    page: String(currentPage),
                  },
                }}
              >
                <p className="font-semibold underline-offset-4 hover:underline">
                  #{(currentPage - 1) * PAGE_SIZE + index + 1}{" "}
                  {item.name ?? "Unknown shop"}
                </p>
              </Link>
              <p className="text-sm text-muted-foreground">
                {item.city ?? "Unknown city"}, {item.state ?? "Unknown state"}
              </p>
              <p className="text-sm">
                Avg sentiment: {item.avg_sentiment_polarity.toFixed(3)} · Matching reviews:{" "}
                {item.matching_review_count}
              </p>
            </div>
          ))}
          {!loading &&
          results.length === 0 &&
          !error &&
          lastSearchedPhrase !== null &&
          lastSearchedPhrase === phrase.trim() ? (
            <p className="text-sm text-muted-foreground">
              No matching results found.
            </p>
          ) : null}

          {!loading && !error && totalResults > 0 ? (
            <p className="text-sm text-muted-foreground">
              Showing page {currentPage} of {totalPages} ({totalResults} total results)
            </p>
          ) : null}

          {!loading && !error && totalPages > 1 ? (
            <Pagination className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    disabled={currentPage <= 1}
                    onClick={() => {
                      if (currentPage > 1) fetchSearch(currentPage - 1)
                    }}
                  />
                </PaginationItem>
                {pageNumbers(totalPages, currentPage).map((pageNum) => (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={pageNum === currentPage}
                      onClick={() => fetchSearch(pageNum)}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      if (currentPage < totalPages) fetchSearch(currentPage + 1)
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}

          <p className="pt-4 text-xs text-muted-foreground">
            Disclaimer: Rankings and review snippets shown here are derived from the Yelp academic dataset.
          </p>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <React.Suspense
      fallback={
        <section className="relative min-h-screen grid place-items-center py-10 sm:py-14">
          <FallingBobaBackground />
          <div className="relative z-10 text-center text-sm text-muted-foreground">
            Loading search...
          </div>
        </section>
      }
    >
      <HomeContent />
    </React.Suspense>
  )
}