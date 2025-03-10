import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="w-full py-12 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Testimonials</div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Trusted by Researchers Worldwide</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              See what scientists and researchers are saying about SpheroSeg.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image
                      src="/placeholder.svg?height=50&width=50"
                      alt="Dr. Emily Chen"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">Dr. Emily Chen</h3>
                    <p className="text-sm text-muted-foreground">Cellular Biology, Stanford University</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  "SpheroSeg has revolutionized our cell analysis workflow. The precision and speed are unmatched by any
                  other tool we've used."
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image
                      src="/placeholder.svg?height=50&width=50"
                      alt="Prof. James Wilson"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">Prof. James Wilson</h3>
                    <p className="text-sm text-muted-foreground">Biomedical Engineering, MIT</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  "The collaboration features in SpheroSeg have transformed how our lab works together on complex
                  imaging projects."
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image
                      src="/placeholder.svg?height=50&width=50"
                      alt="Dr. Sarah Johnson"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">Dr. Sarah Johnson</h3>
                    <p className="text-sm text-muted-foreground">Neuroscience, Oxford University</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  "The statistical analysis tools in SpheroSeg have helped us uncover patterns in our data that we would
                  have otherwise missed."
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

